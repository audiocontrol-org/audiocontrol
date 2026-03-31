# devenv.nix for audiocontrol TypeScript monorepo
#
# This provides a declarative development environment that:
# - Sets up Node.js, pnpm, and Playwright
# - Provides scripts for building and testing
#
# Usage:
#   devenv shell              # Enter development shell
#   devenv up                 # Start midi-server + vite

{ pkgs, lib, config, inputs, ... }:

{
  # Node.js environment
  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
  };

  # System packages
  packages = [
    pkgs.pnpm
    pkgs.git
    pkgs.coreutils
  ];

  # Environment variables
  env = {
    PLAYWRIGHT_BROWSERS_PATH = "${config.devenv.state}/playwright-browsers";
  };

  # Shell hook
  enterShell = ''
    echo ""
    echo "audiocontrol devenv environment"
    echo "================================"
    echo ""
    echo "Available commands:"
    echo "  pnpm install                    Install npm dependencies"
    echo "  make                            Build all modules"
    echo "  pnpm test                       Run unit tests"
    echo "  npx playwright install          Install Playwright browsers"
    echo ""
  '';
}
