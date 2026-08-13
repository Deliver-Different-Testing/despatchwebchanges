FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /App

# Build args for NuGet authentication (passed via --build-arg in CI)
ARG GITLAB_NUGET_USERNAME
ARG GITLAB_NUGET_TOKEN

# Node.js 20 + npm — copied from the official image (no NodeSource CDN dependency)
COPY --from=node:20-bookworm-slim /usr/local/bin/node /usr/local/bin/node
COPY --from=node:20-bookworm-slim /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -sf ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

# Copy nuget.config, build props, and csproj for restore layer caching
COPY nuget.config Directory.Build.props Directory.Packages.props ./
COPY *.csproj ./
RUN GITLAB_NUGET_USERNAME=${GITLAB_NUGET_USERNAME} \
    GITLAB_NUGET_TOKEN=${GITLAB_NUGET_TOKEN} \
    dotnet restore DespatchWeb.csproj

# Copy the npm manifests for install layer caching, mirroring the restore layer above.
# `npm ci` installs exactly what the lockfile pins, and keeping it ahead of `COPY . ./`
# means editing source doesn't rebuild node_modules.
COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN dotnet publish DespatchWeb.csproj -c Release -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 as base
COPY --from=build-env /publish /app
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["dotnet", "DespatchWeb.dll"]
