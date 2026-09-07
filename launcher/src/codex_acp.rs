use std::env;
use std::path::PathBuf;
use std::process::{exit, Command};

fn main() {
    let root = env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(PathBuf::from))
        .unwrap_or_else(|| fail("cannot locate the Codex ACP runtime"));
    let node = root
        .join("runtime")
        .join(if cfg!(windows) { "node.exe" } else { "node" });
    let cli = root
        .join("app")
        .join("node_modules")
        .join("@agentclientprotocol")
        .join("codex-acp")
        .join("dist")
        .join("index.js");
    if !node.is_file() || !cli.is_file() {
        fail("the Codex ACP runtime package is incomplete");
    }

    let status = Command::new(node)
        .arg(cli)
        .args(env::args_os().skip(1))
        .status()
        .unwrap_or_else(|error| fail(&format!("cannot start Codex ACP: {error}")));
    exit(status.code().unwrap_or(1));
}

fn fail(message: &str) -> ! {
    eprintln!("codex-acp: {message}");
    exit(1)
}
