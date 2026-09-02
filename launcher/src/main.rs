use std::env;
use std::path::PathBuf;
use std::process::{exit, Command};

fn main() {
    let root = env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(PathBuf::from))
        .unwrap_or_else(|| fail("cannot locate the OpenCodex runtime"));
    let node = root
        .join("runtime")
        .join(if cfg!(windows) { "node.exe" } else { "node" });
    let cli = root
        .join("app")
        .join("node_modules")
        .join("@bitkyc08")
        .join("opencodex")
        .join("bin")
        .join("ocx.mjs");
    if !node.is_file() || !cli.is_file() {
        fail("the OpenCodex runtime package is incomplete");
    }

    let mut command = Command::new(node);
    command.arg(cli).args(env::args_os().skip(1));

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        let error = command.exec();
        fail(&format!("cannot start OpenCodex: {error}"));
    }

    #[cfg(windows)]
    match command.status() {
        Ok(status) => exit(status.code().unwrap_or(1)),
        Err(error) => fail(&format!("cannot start OpenCodex: {error}")),
    }
}

fn fail(message: &str) -> ! {
    eprintln!("opencodex: {message}");
    exit(1)
}
