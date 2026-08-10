/* ============================================================================
   split-job-booked-time-diagnosis.sql

   Symptom : after splitting a job, the dispatch grid's "Remaining" column on
             both legs shows the FULL speed window again instead of the time
             actually left (a 1 hour job with 15 minutes elapsed shows 60, not 45).

   Why this : Remaining is computed as
              (ucjbDate + ucjbTime) + tucJobType.Minutes - tenant now.
              SplitJobService copies ucjbDate/ucjbTime/ucjbSpeed verbatim onto
              both legs and nothing in the C# touches them afterwards, so a
              reset can only mean a database object rewrote them after insert.
              Prime suspect: DES_stpJob_ColsolidateMarsInformation, which the
              split calls once both legs exist and whose body is not in
              dbmigrationsv2.

   Safety  : READ-ONLY. No INSERT / UPDATE / DELETE / DDL.
   Run on  : the tenant database that reported the problem.
   Tip     : SSMS > Results To Text, and set Query Options > Results > Text >
             "Maximum characters per column" to 8000 so proc bodies are not cut.
   ============================================================================ */

SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;   -- never block live despatch
GO

PRINT '';
PRINT '== 1. Triggers on dbo.tucJob (enabled first) =============================';
GO

SELECT
    CASE WHEN tr.is_disabled = 1 THEN 'disabled' ELSE 'ENABLED' END AS State,
    tr.name                                                         AS TriggerName,
    STUFF((SELECT ', ' + te.type_desc
           FROM sys.trigger_events AS te
           WHERE te.object_id = tr.object_id
           FOR XML PATH(''), TYPE).value('.', 'nvarchar(max)'), 1, 2, '') AS FiresOn,
    CASE WHEN m.definition LIKE N'%ucjbDate%'  THEN 'yes' ELSE '' END AS MentionsDate,
    CASE WHEN m.definition LIKE N'%ucjbTime%'  THEN 'yes' ELSE '' END AS MentionsTime,
    CASE WHEN m.definition LIKE N'%ucjbSpeed%' THEN 'yes' ELSE '' END AS MentionsSpeed,
    tr.modify_date                                                  AS LastModified
FROM sys.triggers AS tr
LEFT JOIN sys.sql_modules AS m ON m.object_id = tr.object_id
WHERE tr.parent_id = OBJECT_ID(N'dbo.tucJob')
ORDER BY tr.is_disabled, tr.name;
GO

PRINT '';
PRINT '== 2. Every module whose text WRITES ucjbDate / ucjbTime =================';
PRINT '   (line breaks flattened first so multi-line SET lists are caught)';
GO

WITH flat AS (
    SELECT
        o.type_desc,
        QUOTENAME(SCHEMA_NAME(o.schema_id)) + N'.' + QUOTENAME(o.name) AS ModuleName,
        o.modify_date,
        REPLACE(REPLACE(REPLACE(sm.definition, CHAR(13), N' '), CHAR(10), N' '), CHAR(9), N' ') AS body
    FROM sys.sql_modules AS sm
    JOIN sys.objects     AS o ON o.object_id = sm.object_id
    WHERE sm.definition LIKE N'%tucJob%'
),
hits AS (
    SELECT
        ModuleName, type_desc, modify_date, body,
        DateWritePos = CHARINDEX(N'ucjbDate =', body) + CHARINDEX(N'ucjbDate=', body),
        TimeWritePos = CHARINDEX(N'ucjbTime =', body) + CHARINDEX(N'ucjbTime=', body)
    FROM flat
    WHERE body LIKE N'%UPDATE%'
      AND (body LIKE N'%ucjbDate =%' OR body LIKE N'%ucjbDate=%'
        OR body LIKE N'%ucjbTime =%' OR body LIKE N'%ucjbTime=%')
)
SELECT
    type_desc  AS ObjectType,
    ModuleName,
    modify_date AS LastModified,
    SUBSTRING(body, CASE WHEN DateWritePos > 150 THEN DateWritePos - 150 ELSE 1 END, 400) AS DateSnippet,
    SUBSTRING(body, CASE WHEN TimeWritePos > 150 THEN TimeWritePos - 150 ELSE 1 END, 400) AS TimeSnippet
FROM hits
ORDER BY
    CASE WHEN ModuleName LIKE N'%ColsolidateMars%' THEN 0
         WHEN ModuleName LIKE N'%RestoreDevice%'   THEN 1
         WHEN ModuleName LIKE N'%tucJob_Insert%'   THEN 2
         ELSE 9 END,
    ModuleName;
GO

PRINT '';
PRINT '   2b. Columns SQL Server itself reports the two split procs update';
GO

IF OBJECT_ID(N'dbo.DES_stpJob_ColsolidateMarsInformation') IS NOT NULL
    SELECT N'DES_stpJob_ColsolidateMarsInformation' AS Module,
           re.referenced_minor_name AS ColumnName, re.is_updated, re.is_selected
    FROM sys.dm_sql_referenced_entities(N'dbo.DES_stpJob_ColsolidateMarsInformation', N'OBJECT') AS re
    WHERE re.referenced_entity_name = N'tucJob'
      AND (re.is_updated = 1 OR re.referenced_minor_name IN (N'ucjbDate', N'ucjbTime', N'ucjbSpeed'))
    ORDER BY re.is_updated DESC, re.referenced_minor_name;
GO

IF OBJECT_ID(N'dbo.UTL_stpJob_RestoreDevice') IS NOT NULL
    SELECT N'UTL_stpJob_RestoreDevice' AS Module,
           re.referenced_minor_name AS ColumnName, re.is_updated, re.is_selected
    FROM sys.dm_sql_referenced_entities(N'dbo.UTL_stpJob_RestoreDevice', N'OBJECT') AS re
    WHERE re.referenced_entity_name = N'tucJob'
      AND (re.is_updated = 1 OR re.referenced_minor_name IN (N'ucjbDate', N'ucjbTime', N'ucjbSpeed'))
    ORDER BY re.is_updated DESC, re.referenced_minor_name;
GO

PRINT '';
PRINT '== 3. Body: DES_stpJob_ColsolidateMarsInformation ========================';
PRINT '   (the split calls this AFTER both legs are inserted)';
GO

IF OBJECT_ID(N'dbo.DES_stpJob_ColsolidateMarsInformation') IS NULL
    PRINT '  !! dbo.DES_stpJob_ColsolidateMarsInformation does not exist on this server';
ELSE
    EXEC sp_helptext N'dbo.DES_stpJob_ColsolidateMarsInformation';
GO

PRINT '';
PRINT '== 4. Body: UTL_stpJob_RestoreDevice =====================================';
PRINT '   (runs before the legs exist, but writes to the parent)';
GO

IF OBJECT_ID(N'dbo.UTL_stpJob_RestoreDevice') IS NULL
    PRINT '  !! dbo.UTL_stpJob_RestoreDevice does not exist on this server';
ELSE
    EXEC sp_helptext N'dbo.UTL_stpJob_RestoreDevice';
GO

PRINT '';
PRINT '== 5. Recent split families: parent vs legs ==============================';
GO

DECLARE @Days     int = 30;   -- how far back to look
DECLARE @Families int = 40;   -- how many split families to show

/* ---- 5a. Every row of the most recently split families ------------------- */
;WITH families AS (
    SELECT TOP (@Families)
           FamilyRootID      = ISNULL(c.RootParentID, c.ParentID),
           LastLegCreatedUtc = MAX(c.CreatedTimeUtc)
    FROM dbo.tucJob AS c
    WHERE c.JobRelationshipTypeID = 9                       -- SplitChild
      AND c.CreatedTimeUtc >= DATEADD(DAY, -@Days, GETUTCDATE())
    GROUP BY ISNULL(c.RootParentID, c.ParentID)
    ORDER BY MAX(c.CreatedTimeUtc) DESC
)
SELECT
    f.FamilyRootID,
    Role = CASE j.JobRelationshipTypeID
                WHEN 8 THEN 'PARENT'
                WHEN 9 THEN '  leg'
                ELSE CONVERT(varchar(12), j.JobRelationshipTypeID) END,
    j.ucjbID,
    j.ucjbNumber,
    j.[Sequence],
    j.ParentID,
    j.RootParentID,
    j.ucjbDate,
    j.ucjbTime,
    /* Booked, exactly as the app combines it: date part + time part */
    Booked = DATEADD(SECOND,
                     DATEDIFF(SECOND, 0, CONVERT(time(0), ISNULL(j.ucjbTime, '00:00:00'))),
                     CONVERT(datetime, CONVERT(date, j.ucjbDate))),
    j.ucjbSpeed,
    SpeedName    = jt.ucjtName,
    SpeedMinutes = jt.[Minutes],
    Deadline     = DATEADD(MINUTE, jt.[Minutes],
                     DATEADD(SECOND,
                             DATEDIFF(SECOND, 0, CONVERT(time(0), ISNULL(j.ucjbTime, '00:00:00'))),
                             CONVERT(datetime, CONVERT(date, j.ucjbDate)))),
    j.ucjbClientID,
    j.ucjbVoid,
    j.CreatedTimeUtc
FROM families AS f
JOIN dbo.tucJob AS j ON ISNULL(j.RootParentID, j.ucjbID) = f.FamilyRootID
LEFT JOIN dbo.tucJobType AS jt ON jt.ucjtID = j.ucjbSpeed
ORDER BY f.LastLegCreatedUtc DESC, f.FamilyRootID, j.[Sequence], j.ucjbID;

/* ---- 5b. Drift only: each leg against its parent -------------------------- */
;WITH legs AS (
    SELECT c.ucjbID, c.ucjbNumber, c.[Sequence], c.ucjbDate, c.ucjbTime, c.ucjbSpeed,
           c.RootParentID, c.CreatedTimeUtc,
           ParentJobID = ISNULL(c.ParentID, c.RootParentID)
    FROM dbo.tucJob AS c
    WHERE c.JobRelationshipTypeID = 9
      AND c.CreatedTimeUtc >= DATEADD(DAY, -@Days, GETUTCDATE())
)
SELECT
    FamilyRootID = l.RootParentID,
    ParentID     = p.ucjbID,   ParentNumber = p.ucjbNumber,
    ParentDate   = p.ucjbDate, ParentTime   = p.ucjbTime, ParentSpeed = p.ucjbSpeed,
    LegID        = l.ucjbID,   LegNumber    = l.ucjbNumber, l.[Sequence],
    LegDate      = l.ucjbDate, LegTime      = l.ucjbTime,   LegSpeed    = l.ucjbSpeed,
    BookedDriftMinutes = DATEDIFF(MINUTE, bp.Booked, bl.Booked),
    DriftFlags   = CASE WHEN l.ucjbSpeed <> p.ucjbSpeed THEN 'SPEED' ELSE '' END
                 + CASE WHEN CONVERT(date, l.ucjbDate) <> CONVERT(date, p.ucjbDate)
                        THEN ' DATE' ELSE '' END
                 + CASE WHEN ISNULL(CONVERT(time(0), l.ucjbTime), '00:00:00')
                          <> ISNULL(CONVERT(time(0), p.ucjbTime), '00:00:00')
                        THEN ' TIME' ELSE '' END,
    /* If a leg's window was rebased onto insert time this lands near the tenant's
       UTC offset (e.g. -720 / -780 for NZ) rather than a scattered value. */
    LegBookedVsCreatedUtcMins = DATEDIFF(MINUTE, bl.Booked, l.CreatedTimeUtc),
    LegCreatedUtc    = l.CreatedTimeUtc,
    ParentCreatedUtc = p.CreatedTimeUtc
FROM legs AS l
JOIN dbo.tucJob AS p ON p.ucjbID = l.ParentJobID
CROSS APPLY (SELECT Booked = DATEADD(SECOND,
                 DATEDIFF(SECOND, 0, CONVERT(time(0), ISNULL(p.ucjbTime, '00:00:00'))),
                 CONVERT(datetime, CONVERT(date, p.ucjbDate)))) AS bp
CROSS APPLY (SELECT Booked = DATEADD(SECOND,
                 DATEDIFF(SECOND, 0, CONVERT(time(0), ISNULL(l.ucjbTime, '00:00:00'))),
                 CONVERT(datetime, CONVERT(date, l.ucjbDate)))) AS bl
WHERE CONVERT(date, l.ucjbDate) <> CONVERT(date, p.ucjbDate)
   OR ISNULL(CONVERT(time(0), l.ucjbTime), '00:00:00')
      <> ISNULL(CONVERT(time(0), p.ucjbTime), '00:00:00')
   OR l.ucjbSpeed <> p.ucjbSpeed
ORDER BY l.CreatedTimeUtc DESC;
GO

PRINT '';
PRINT 'Done. Reading the results:';
PRINT '  * 5b empty                     -> legs DO inherit the parent window; the';
PRINT '                                    reset is on the read side (Booked mapping,';
PRINT '                                    speed Minutes, tenant clock), not the write side.';
PRINT '  * 5b rows flagged DATE or TIME -> confirmed write-side drift. Cross-reference';
PRINT '                                    the module list in section 2 and the proc';
PRINT '                                    bodies in sections 3 and 4.';
PRINT '  * DriftFlags = SPEED only      -> expected for some clients: tucJob_InsertJob';
PRINT '                                    rewrites ucjbSpeed on insert. Not this bug.';
GO
