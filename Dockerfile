# -- Stage 1: build the Vite SPA (DespatchWeb.Client -> wwwroot/dist) --
FROM node:20-alpine AS frontend-build
WORKDIR /frontend/DespatchWeb.Client

# Every dependency comes from npmjs.org except @deliver-different/glass, which comes from the GitLab
# npm registry; .npmrc reads the token from this build arg.
ARG GITLAB_NUGET_TOKEN

# Manifests first so editing source doesn't rebuild node_modules. `npm ci` installs exactly what the
# lockfile pins and fails if the two have drifted.
COPY DespatchWeb.Client/package.json DespatchWeb.Client/package-lock.json DespatchWeb.Client/.npmrc ./
RUN GITLAB_NUGET_TOKEN=${GITLAB_NUGET_TOKEN} npm ci

# vite.config.ts writes the bundle to ../wwwroot/dist, i.e. /frontend/wwwroot/dist.
COPY DespatchWeb.Client/ ./
RUN npm run build

# -- Stage 2: build the .NET host --
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /App

# Build args for NuGet authentication (passed via --build-arg in CI)
ARG GITLAB_NUGET_USERNAME
ARG GITLAB_NUGET_TOKEN

# Copy nuget.config, build props, and csproj for restore layer caching
COPY nuget.config Directory.Build.props Directory.Packages.props ./
COPY *.csproj ./
RUN GITLAB_NUGET_USERNAME=${GITLAB_NUGET_USERNAME} \
    GITLAB_NUGET_TOKEN=${GITLAB_NUGET_TOKEN} \
    dotnet restore DespatchWeb.csproj

COPY . ./
# The SPA is already built in the stage above; CI=true skips the csproj's npm build step.
COPY --from=frontend-build /frontend/wwwroot/dist ./wwwroot/dist
ENV CI=true
RUN dotnet publish DespatchWeb.csproj -c Release -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 as base
COPY --from=build-env /publish /app
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["dotnet", "DespatchWeb.dll"]
