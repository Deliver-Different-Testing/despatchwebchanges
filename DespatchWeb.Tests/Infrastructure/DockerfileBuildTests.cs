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

    [Theory]
    [InlineData("package.json")]
    [InlineData("package-lock.json")]
    public void Dockerfile_CopiesNpmManifest_BeforeNpmInstall(string fileName)
    {
        var installLineIndex = NpmInstallLineIndex();

        var copyLineIndex = Array.FindIndex(DockerfileLines, 0, installLineIndex,
            l => l.StartsWith("COPY", StringComparison.OrdinalIgnoreCase)
                 && l.Contains(fileName, StringComparison.OrdinalIgnoreCase));

        Assert.True(copyLineIndex > -1,
            $"{fileName} must be copied into the Docker build context before npm installs. " +
            "Copying the whole source tree first invalidates the npm layer on every code change.");
    }

    [Fact]
    public void Dockerfile_CopiesFullSource_AfterNpmInstall()
    {
        // This is the actual caching property: if `COPY . ./` runs before npm, the
        // install layer is busted by any source edit and node_modules is rebuilt every
        // image build.
        var installLineIndex = NpmInstallLineIndex();

        var fullCopyIndex = Array.FindIndex(DockerfileLines,
            l => l.Trim().StartsWith("COPY . ", StringComparison.OrdinalIgnoreCase));

        Assert.True(fullCopyIndex > -1, "Dockerfile should copy the full source tree");
        Assert.True(fullCopyIndex > installLineIndex,
            "`COPY . ./` must come after the npm install step so the dependency layer stays cached.");
    }

    [Fact]
    public void Dockerfile_UsesNpmCi_ForReproducibleInstalls()
    {
        // npm ci installs exactly what package-lock.json pins and fails if the two have
        // drifted; npm install will happily resolve something newer mid-release.
        var installLine = DockerfileLines[NpmInstallLineIndex()];

        Assert.Contains("npm ci", installLine, StringComparison.OrdinalIgnoreCase);
    }

    private static int NpmInstallLineIndex()
    {
        var index = Array.FindIndex(DockerfileLines,
            l => !l.TrimStart().StartsWith('#')
                 && (l.Contains("npm ci", StringComparison.OrdinalIgnoreCase)
                     || l.Contains("npm install", StringComparison.OrdinalIgnoreCase)));

        Assert.True(index > -1, "Dockerfile should install npm dependencies");
        return index;
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
