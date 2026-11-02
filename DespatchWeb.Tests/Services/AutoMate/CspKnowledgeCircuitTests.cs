using DespatchWeb.Services.AutoMate;

namespace DespatchWeb.Tests.Services.AutoMate;

public class CspKnowledgeCircuitTests
{
    private readonly ManualTimeProvider _time = new();

    private CspKnowledgeCircuit Create() => new(_time);

    [Fact]
    public void StartsClosed() => Assert.False(Create().IsOpen);

    [Fact]
    public void TransientFailures_OpenOnlyAtTheThreshold_AndCloseAfterTheBreak()
    {
        var circuit = Create();
        circuit.RecordFailure("a", permanent: false);
        circuit.RecordFailure("b", permanent: false);
        Assert.False(circuit.IsOpen);

        circuit.RecordFailure("c", permanent: false);
        Assert.True(circuit.IsOpen);

        _time.Advance(CspKnowledgeCircuit.TransientBreak - TimeSpan.FromSeconds(1));
        Assert.True(circuit.IsOpen);
        _time.Advance(TimeSpan.FromSeconds(1));
        Assert.False(circuit.IsOpen);
    }

    [Fact]
    public void PermanentFailure_OpensAtOnce_ForTheLongBreak()
    {
        var circuit = Create();
        circuit.RecordFailure("404", permanent: true);

        Assert.True(circuit.IsOpen);
        _time.Advance(CspKnowledgeCircuit.TransientBreak + TimeSpan.FromSeconds(1));
        Assert.True(circuit.IsOpen);
        _time.Advance(CspKnowledgeCircuit.PermanentBreak);
        Assert.False(circuit.IsOpen);
    }

    [Fact]
    public void ASuccess_ResetsTheConsecutiveCount_AndClosesTheCircuit()
    {
        var circuit = Create();
        circuit.RecordFailure("a", permanent: false);
        circuit.RecordFailure("b", permanent: false);
        circuit.RecordSuccess();
        circuit.RecordFailure("c", permanent: false);
        circuit.RecordFailure("d", permanent: false);
        Assert.False(circuit.IsOpen);

        circuit.RecordFailure("e", permanent: true);
        circuit.RecordSuccess();
        Assert.False(circuit.IsOpen);
    }

    [Fact]
    public void AFailedProbeAfterTheBreak_ReopensImmediately()
    {
        var circuit = Create();
        for (var i = 0; i < CspKnowledgeCircuit.TransientFailureThreshold; i++)
        {
            circuit.RecordFailure("x", permanent: false);
        }

        _time.Advance(CspKnowledgeCircuit.TransientBreak + TimeSpan.FromSeconds(1));
        Assert.False(circuit.IsOpen);

        circuit.RecordFailure("probe", permanent: false);
        Assert.True(circuit.IsOpen);
    }
}
