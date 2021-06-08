{
  description = "Aho-Corasick in Javascript";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.simpleFlake {
      inherit self nixpkgs;
      name = "aho-js";
      shell = { pkgs }: pkgs.mkShell { buildInputs = [ pkgs.nodejs pkgs.nodePackages.prettier ]; };
    };
}
