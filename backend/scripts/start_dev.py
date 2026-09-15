#!/usr/bin/env python3
"""
Development startup script for Aventra Backend

This script helps with development setup and provides useful utilities.
"""

import os
import sys
import subprocess
from pathlib import Path

# Add parent directory to path
parent_dir = Path(__file__).parent.parent
sys.path.insert(0, str(parent_dir))


def check_env_file():
    """Check if .env file exists and has required variables"""
    env_path = parent_dir / ".env"
    env_example_path = parent_dir / ".env.example"
    
    if not env_path.exists():
        if env_example_path.exists():
            print("⚠️  .env file not found. Creating from .env.example...")
            import shutil
            shutil.copy(env_example_path, env_path)
            print("📝 Please edit .env file with your API keys")
            return False
        else:
            print("❌ Neither .env nor .env.example found")
            return False
    
    # Check for required variables
    required_vars = ["OPENAI_API_KEY"]
    missing_vars = []
    
    with open(env_path) as f:
        env_content = f.read()
        for var in required_vars:
            if f"{var}=" not in env_content or f"{var}=your_" in env_content:
                missing_vars.append(var)
    
    if missing_vars:
        print(f"⚠️  Missing or placeholder values for: {', '.join(missing_vars)}")
        print("📝 Please edit .env file with real API keys")
        return False
    
    print("✅ Environment file configured")
    return True


def check_dependencies():
    """Check if all dependencies are installed"""
    requirements_path = parent_dir / "requirements.txt"
    
    if not requirements_path.exists():
        print("❌ requirements.txt not found")
        return False
    
    try:
        # Check if we can import main modules
        import fastapi
        import uvicorn
        import langchain
        print("✅ Core dependencies available")
        return True
    except ImportError as e:
        print(f"❌ Missing dependencies: {e}")
        print("📦 Run: pip install -r requirements.txt")
        return False


def start_server(host="0.0.0.0", port=8000, reload=True):
    """Start the development server"""
    print(f"🚀 Starting Aventra Backend on {host}:{port}")
    print(f"📚 API Documentation will be available at: http://localhost:{port}/docs")
    print(f"🔧 Debug mode: {'enabled' if reload else 'disabled'}")
    print("─" * 50)
    
    # Import and run
    os.chdir(parent_dir)
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level="debug" if reload else "info"
    )


def run_health_check():
    """Run health check on the API"""
    import requests
    import time
    
    print("🔍 Running health check...")
    
    # Wait a moment for server to start
    time.sleep(2)
    
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✅ Server is healthy")
            
            # Check debug endpoint
            try:
                debug_response = requests.get("http://localhost:8000/api/debug/health", timeout=5)
                if debug_response.status_code == 200:
                    data = debug_response.json()
                    print(f"✅ Debug endpoint healthy")
                    if 'services' in data:
                        for service, info in data['services'].items():
                            status = info.get('status', 'unknown')
                            print(f"   - {service}: {status}")
                else:
                    print("⚠️  Debug endpoint not responding")
            except:
                print("⚠️  Could not check debug endpoint")
                
        else:
            print(f"❌ Server health check failed: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Could not connect to server: {e}")


def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Aventra Backend Development Tools")
    parser.add_argument("--check", action="store_true", help="Run setup checks only")
    parser.add_argument("--health", action="store_true", help="Run health check")
    parser.add_argument("--host", default="0.0.0.0", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind to")
    parser.add_argument("--no-reload", action="store_true", help="Disable auto-reload")
    
    args = parser.parse_args()
    
    print("🎮 Aventra Backend Development Setup")
    print("═" * 40)
    
    # Run checks
    env_ok = check_env_file()
    deps_ok = check_dependencies()
    
    if args.check:
        if env_ok and deps_ok:
            print("✅ All checks passed!")
            return 0
        else:
            print("❌ Some checks failed")
            return 1
    
    if args.health:
        run_health_check()
        return 0
    
    if not env_ok:
        print("\n⚠️  Environment not properly configured")
        print("   Please fix the issues above before starting the server")
        return 1
    
    if not deps_ok:
        print("\n⚠️  Dependencies not properly installed")
        print("   Please run: pip install -r requirements.txt")
        return 1
    
    print("\n🎯 Starting development server...")
    try:
        start_server(
            host=args.host,
            port=args.port,
            reload=not args.no_reload
        )
    except KeyboardInterrupt:
        print("\n👋 Server stopped by user")
        return 0
    except Exception as e:
        print(f"\n❌ Error starting server: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())