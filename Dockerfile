FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /App

# Build args for NuGet authentication (passed via --build-arg in CI)
ARG GITLAB_NUGET_USERNAME
ARG GITLAB_NUGET_TOKEN

# Install Node.js and npm
RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

# Copy nuget.config, build props, and csproj for restore layer caching
COPY nuget.config Directory.Build.props Directory.Packages.props ./
COPY *.csproj ./
RUN GITLAB_NUGET_USERNAME=${GITLAB_NUGET_USERNAME} \
    GITLAB_NUGET_TOKEN=${GITLAB_NUGET_TOKEN} \
    dotnet restore DespatchWeb.csproj

COPY . ./
RUN npm install
RUN dotnet publish DespatchWeb.csproj -c Release -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 as base
COPY --from=build-env /publish /app
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["dotnet", "DespatchWeb.dll"]
