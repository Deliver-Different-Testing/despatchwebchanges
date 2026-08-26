/*
    READ-ONLY diagnostic for "POD data disconnected - E4672MD" (LifeHealthcare).

    POD signatures and photos are written to S3 under {folder}/{yyyy}/{MM}/{jobId}-...  where jobId
    is the numeric id of the leg the courier completed. The client can see two images named
    26953623-DeliveryPhoto-1 and 26981620-DS -- two different job ids, neither of them the parent
    E4672MD, which is why POD-E4672MD.pdf came out with an empty signature box and no photos.

    This confirms which rows those two ids are and that the family-aware lookup will reach them.
    No writes, no schema changes.
*/

DECLARE @JobNumber varchar(50) = 'E4672MD';

-- 1. The whole family, live and archived, with the timestamps that key the S3 month folder.
WITH Family AS (
    SELECT 'live' AS Source, ucjbID, ucjbNumber, ParentID, ucjbVoid, ucjbJobDone,
           ucjbPODName, ucjbComplTime, PickUpTime, ucjbDispDate, ucjbDispTime
    FROM   dbo.tucJob
    WHERE  ucjbNumber LIKE @JobNumber + '%'
    UNION ALL
    SELECT 'archive', ucjbID, ucjbNumber, ParentID, ucjbVoid, ucjbJobDone,
           ucjbPODName, ucjbComplTime, PickUpTime, ucjbDispDate, ucjbDispTime
    FROM   dbo.tucJobArchive
    WHERE  ucjbNumber LIKE @JobNumber + '%'
)
SELECT   Source,
         ucjbID,
         ucjbNumber,
         ParentID,
         CASE WHEN ISNULL(ParentID, ucjbID) = ucjbID THEN 'PARENT' ELSE 'leg' END AS Role,
         ucjbVoid,
         ucjbJobDone,
         ucjbPODName,
         ucjbComplTime,
         PickUpTime,
         ucjbDispDate,
         ucjbDispTime
FROM     Family
ORDER BY Role DESC, ucjbNumber;

-- 2. The two ids from the client's screenshot, wherever they live.
SELECT 'live' AS Source, ucjbID, ucjbNumber, ParentID, ucjbComplTime, ucjbPODName
FROM   dbo.tucJob
WHERE  ucjbID IN (26953623, 26981620)
UNION ALL
SELECT 'archive', ucjbID, ucjbNumber, ParentID, ucjbComplTime, ucjbPODName
FROM   dbo.tucJobArchive
WHERE  ucjbID IN (26953623, 26981620);
