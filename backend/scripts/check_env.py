import os
import sys

MASKED_NOT_SET = "not set"

def mask(v: str | None) -> str:
    if not v:
        return MASKED_NOT_SET
    return (v[:4] + "***" + v[-4:]) if len(v) > 8 else "****"


def get_registry_env(name: str, scope: str) -> str:
    try:
        import platform
        if platform.system() != "Windows":
            return MASKED_NOT_SET
        import winreg
        if scope == "User":
            key_path = r"Environment"
            hive = winreg.HKEY_CURRENT_USER
        elif scope == "Machine":
            key_path = r"SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment"
            hive = winreg.HKEY_LOCAL_MACHINE
        else:
            return MASKED_NOT_SET
        try:
            with winreg.OpenKey(hive, key_path, 0, winreg.KEY_READ) as k:
                value, _ = winreg.QueryValueEx(k, name)
                return mask(value)
        except FileNotFoundError:
            return MASKED_NOT_SET
    except Exception as e:
        return f"error:{e.__class__.__name__}"


def main():
    name = os.environ.get("NAME", "OPENAI_API_KEY")
    print(f"Checking environment for {name} (masked):")

    # Process (current shell)
    print("Process=", mask(os.environ.get(name)))

    # User/Machine from Windows Registry
    print("User=", get_registry_env(name, "User"))
    print("Machine=", get_registry_env(name, "Machine"))

    # Fallback vars
    fb = "FALLBACK_API_KEY"
    print(f"\nFallback var {fb} (masked):")
    print("Process=", mask(os.environ.get(fb)))
    print("User=", get_registry_env(fb, "User"))
    print("Machine=", get_registry_env(fb, "Machine"))

if __name__ == "__main__":
    main()
