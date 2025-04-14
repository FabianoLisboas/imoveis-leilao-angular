const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Caminhos dos arquivos
const angularJsonPath = path.join(__dirname, 'angular.json');
const appConfigPath = path.join(__dirname, 'src/app/app.config.ts');
const mainServerPath = path.join(__dirname, 'src/main.server.ts');
const serverPath = path.join(__dirname, 'src/server.ts');
const proxyConfigPath = path.join(__dirname, 'proxy.conf.json');

// Configuração de proxy para resolver problemas de autenticação
const createProxyConfig = () => {
  console.log('Criando configuração de proxy otimizada...');
  const proxyConfig = {
    "/api": {
      "target": "http://localhost:8000",
      "secure": false,
      "logLevel": "debug",
      "changeOrigin": true,
      "timeout": 30000,
      "proxyTimeout": 30000,
      "cookieDomainRewrite": "localhost",
      "withCredentials": true,
      "headers": {
        "X-Requested-With": "XMLHttpRequest"
      }
    }
  };
  
  fs.writeFileSync(proxyConfigPath, JSON.stringify(proxyConfig, null, 2));
  console.log('Arquivo proxy.conf.json criado com sucesso!');
};

// Backup dos arquivos originais
const backupFiles = () => {
  console.log('Fazendo backup dos arquivos originais...');
  if (!fs.existsSync(`${angularJsonPath}.bak`)) {
    fs.copyFileSync(angularJsonPath, `${angularJsonPath}.bak`);
  }
  if (!fs.existsSync(`${appConfigPath}.bak`)) {
    fs.copyFileSync(appConfigPath, `${appConfigPath}.bak`);
  }
  if (!fs.existsSync(`${mainServerPath}.bak`)) {
    fs.copyFileSync(mainServerPath, `${mainServerPath}.bak`);
  }
  if (!fs.existsSync(`${serverPath}.bak`)) {
    fs.copyFileSync(serverPath, `${serverPath}.bak`);
  }
  if (fs.existsSync(proxyConfigPath) && !fs.existsSync(`${proxyConfigPath}.bak`)) {
    fs.copyFileSync(proxyConfigPath, `${proxyConfigPath}.bak`);
  }
};

// Modificar os arquivos para desativar SSR
const disableSSR = () => {
  console.log('Desativando SSR...');
  
  // Modificar angular.json
  let angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));
  delete angularJson.projects.frontend.architect.build.options.server;
  delete angularJson.projects.frontend.architect.build.options.ssr;
  fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));
  
  // Modificar app.config.ts - já está modificado conforme vimos
  
  // Criar versões vazias dos arquivos de servidor
  fs.writeFileSync(mainServerPath, 'export default () => {};');
  fs.writeFileSync(serverPath, 'export default {};');
};

// Restaurar os arquivos originais
const restoreFiles = () => {
  console.log('Restaurando arquivos originais...');
  if (fs.existsSync(`${angularJsonPath}.bak`)) {
    fs.copyFileSync(`${angularJsonPath}.bak`, angularJsonPath);
  }
  if (fs.existsSync(`${appConfigPath}.bak`)) {
    fs.copyFileSync(`${appConfigPath}.bak`, appConfigPath);
  }
  if (fs.existsSync(`${mainServerPath}.bak`)) {
    fs.copyFileSync(`${mainServerPath}.bak`, mainServerPath);
  }
  if (fs.existsSync(`${serverPath}.bak`)) {
    fs.copyFileSync(`${serverPath}.bak`, serverPath);
  }
  if (fs.existsSync(`${proxyConfigPath}.bak`)) {
    fs.copyFileSync(`${proxyConfigPath}.bak`, proxyConfigPath);
  }
};

// Iniciar o servidor Angular
const startAngular = () => {
  console.log('Iniciando servidor Angular sem SSR...');
  try {
    execSync('ng serve --proxy-config proxy.conf.json', { stdio: 'inherit' });
  } catch (error) {
    console.error('Erro ao iniciar o servidor Angular:', error);
  }
};

// Função principal
const main = () => {
  backupFiles();
  disableSSR();
  createProxyConfig();
  
  // Registrar handlers para restaurar arquivos ao fechar
  process.on('SIGINT', () => {
    restoreFiles();
    process.exit();
  });
  
  startAngular();
};

main(); 