FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build-env
WORKDIR /App

# Install Node.js and npm
RUN apt-get update && apt-get install -y curl
RUN curl -sL https://deb.nodesource.com/setup_20.x | bash -
RUN apt-get install -y nodejs

COPY *.csproj ./
RUN dotnet restore

COPY . ./
RUN npm install
RUN dotnet build -c Release --property:OutputPath=/app
RUN dotnet publish -c Release --property:PublishDir=/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 as base
COPY --from=build-env /publish /app
WORKDIR /app
EXPOSE 8080
ENTRYPOINT ["dotnet", "DespatchWeb.dll"]
