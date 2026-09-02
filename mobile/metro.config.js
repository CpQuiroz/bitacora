// Config de Metro para monorepo (npm workspaces): permite resolver
// @bitacora/shared desde packages/shared vía el symlink en
// node_modules que crea `npm install` en la raíz.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Metro observa también la raíz del workspace (para packages/shared).
config.watchFolders = [workspaceRoot];
// Resuelve módulos primero desde mobile/, luego desde la raíz (hoisting).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
