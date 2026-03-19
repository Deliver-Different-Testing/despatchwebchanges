namespace DespatchWeb.Tests.Infrastructure;

/// <summary>
/// Guards against Docker build failures caused by missing MSBuild infrastructure files.
/// The Dockerfile copies files in stages for layer caching — these tests ensure
/// all files required by dotnet restore are copied before the restore step runs.
/// </summary>
public class DockerfileBuildTests
{
    private static readonly string SolutionRoot = FindSolutionRoot();
    private static readonly string[] DockerfileLines = File.ReadAllLines(Path.Combine(SolutionRoot, "Dockerfile"));

    [Theory]
    [InlineData("Directory.Build.props")]
    [InlineData("Directory.Packages.props")]
    public void Dockerfile_CopiesMSBuildFile_BeforeRestore(string fileName)
    {
        // Arrange
        var restoreLineIndex = Array.FindIndex(DockerfileLines,
            l => l.Contains("dotnet restore", StringComparison.OrdinalIgnoreCase));

        Assert.True(restoreLineIndex > -1, "Dockerfile should contain a dotnet restore command");

        // Act - find a COPY line that includes this file, before the restore line
        var copyLineIndex = Array.FindIndex(DockerfileLines, 0, restoreLineIndex,
            l => l.StartsWith("COPY", StringComparison.OrdinalIgnoreCase)
                 && l.Contains(fileName, StringComparison.OrdinalIgnoreCase));

        // Assert
        Assert.True(copyLineIndex > -1,
            $"{fileName} must be copied into the Docker build context before dotnet restore runs. " +
            $"Without it, MSBuild properties defined in {fileName} (like TargetFramework or package versions) will be missing.");
    }

    [Fact]
    public void MSBuildInfrastructureFiles_AllExistOnDisk()
    {
        // Verify the files we expect to be copied actually exist in the repo root
        var expectedFiles = new[] { "Directory.Build.props", "Directory.Packages.props" };

        foreach (var file in expectedFiles)
        {
            var fullPath = Path.Combine(SolutionRoot, file);
            Assert.True(File.Exists(fullPath), $"{file} should exist in the solution root");
        }
    }

    private static string FindSolutionRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "Dockerfile"))) dir = dir.Parent;

        return dir?.FullName ?? throw new InvalidOperationException(
            "Could not find solution root (directory containing Dockerfile)");
    }
}
