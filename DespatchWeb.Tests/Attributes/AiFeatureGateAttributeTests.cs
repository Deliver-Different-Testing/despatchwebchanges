using DespatchWeb.Attributes;
using DespatchWeb.Controllers;
using DespatchWeb.Models;
using JetBrains.Annotations;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Tests.Attributes;

[TestSubject(typeof(AiFeatureGateAttribute))]
public class AiFeatureGateAttributeTests
{
    private static ActionExecutingContext ContextWith(AnthropicSettings settings)
    {
        var services = new ServiceCollection();
        services.AddSingleton(Options.Create(settings));

        var httpContext = new DefaultHttpContext
        {
            RequestServices = services.BuildServiceProvider()
        };

        return new ActionExecutingContext(
            new ActionContext(httpContext, new RouteData(), new ActionDescriptor()),
            [],
            new Dictionary<string, object?>(),
            controller: null!);
    }

    [Fact]
    public void Disabled_ShortCircuitsWith403()
    {
        var context = ContextWith(new AnthropicSettings { Enabled = false });

        new AiFeatureGateAttribute().OnActionExecuting(context);

        var result = Assert.IsType<ObjectResult>(context.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
    }

    [Fact]
    public void Enabled_LetsTheActionRun()
    {
        var context = ContextWith(new AnthropicSettings { Enabled = true });

        new AiFeatureGateAttribute().OnActionExecuting(context);

        Assert.Null(context.Result);
    }

    [Fact]
    public void DefaultSettings_LetTheActionRun()
    {
        var context = ContextWith(new AnthropicSettings());

        new AiFeatureGateAttribute().OnActionExecuting(context);

        Assert.Null(context.Result);
    }

    [Fact]
    public void AiControllerCarriesTheGate_SoNewActionsInheritIt() =>
        Assert.Single(typeof(AiController).GetCustomAttributes(typeof(AiFeatureGateAttribute), inherit: true));
}
