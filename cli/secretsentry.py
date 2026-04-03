#!/usr/bin/env python3
"""
Vault Sentry CLI
=================
Command-line interface for scanning repositories and files for secrets.

Usage:
    VaultSentry scan [PATH] [OPTIONS]
    VaultSentry config [COMMAND]
    VaultSentry report [SCAN_ID]
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / 'backend'))

try:
    from rich.console import Console
    from rich.table import Table
    from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn
    from rich.panel import Panel
    from rich.tree import Tree
    from rich import print as rprint
    RICH_AVAILABLE = True
except ImportError:
    RICH_AVAILABLE = False

# Version
__version__ = '1.0.0'

# Console for rich output
console = Console() if RICH_AVAILABLE else None


class Colors:
    """ANSI color codes for terminal output."""
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    RESET = '\033[0m'


def print_color(text: str, color: str = '', bold: bool = False) -> None:
    """Print colored text to terminal."""
    prefix = Colors.BOLD if bold else ''
    print(f"{prefix}{color}{text}{Colors.RESET}")


def print_banner() -> None:
    """Print the Vault Sentry banner."""
    banner = """
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗███████╗ ██████╗██████╗ ███████╗████████╗           ║
║   ██╔════╝██╔════╝██╔════╝██╔══██╗██╔════╝╚══██╔══╝           ║
║   ███████╗█████╗  ██║     ██████╔╝█████╗     ██║              ║
║   ╚════██║██╔══╝  ██║     ██╔══██╗██╔══╝     ██║              ║
║   ███████║███████╗╚██████╗██║  ██║███████╗   ██║              ║
║   ╚══════╝╚══════╝ ╚═════╝╚═╝  ╚═╝╚══════╝   ╚═╝              ║
║                                                               ║
║   ███████╗███████╗███╗   ██╗████████╗██████╗ ██╗   ██╗        ║
║   ██╔════╝██╔════╝████╗  ██║╚══██╔══╝██╔══██╗╚██╗ ██╔╝        ║
║   ███████╗█████╗  ██╔██╗ ██║   ██║   ██████╔╝ ╚████╔╝         ║
║   ╚════██║██╔══╝  ██║╚██╗██║   ██║   ██╔══██╗  ╚██╔╝          ║
║   ███████║███████╗██║ ╚████║   ██║   ██║  ██║   ██║           ║
║   ╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝           ║
║                                                               ║
║   🔒 Detect exposed secrets in your code                      ║
║   Version: {version:<52}║
╚═══════════════════════════════════════════════════════════════╝
    """.format(version=__version__)
    print_color(banner, Colors.CYAN, bold=True)


def format_risk_level(level: str) -> str:
    """Format risk level with appropriate color."""
    colors = {
        'critical': Colors.RED,
        'high': Colors.YELLOW,
        'medium': Colors.BLUE,
        'low': Colors.GREEN,
        'info': Colors.WHITE
    }
    color = colors.get(level.lower(), Colors.WHITE)
    return f"{color}{level.upper()}{Colors.RESET}"


class VaultSentryCLI:
    """Main CLI class for Vault Sentry."""
    
    def __init__(self):
        self.config_path = Path.home() / '.VaultSentry' / 'config.json'
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from file."""
        default_config = {
            'api_url': 'http://localhost:8000/api/v1',
            'api_key': None,
            'output_format': 'table',
            'ignore_patterns': [
                '*.min.js',
                '*.min.css',
                'node_modules/**',
                '.git/**',
                '__pycache__/**',
                '*.pyc',
                'dist/**',
                'build/**',
                'vendor/**'
            ],
            'severity_threshold': 'low'
        }
        
        if self.config_path.exists():
            try:
                with open(self.config_path) as f:
                    loaded = json.load(f)
                    default_config.update(loaded)
            except Exception:
                pass
        
        return default_config
    
    def _save_config(self) -> None:
        """Save configuration to file."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def scan(
        self,
        path: str,
        output_format: str = 'table',
        severity: str = 'low',
        include_entropy: bool = True,
        output_file: Optional[str] = None,
        verbose: bool = False,
        no_color: bool = False
    ) -> int:
        """Scan a directory or file for secrets."""
        from app.scanner.engine import SecretScanner
        
        path = Path(path).resolve()
        
        if not path.exists():
            print_color(f"Error: Path '{path}' does not exist.", Colors.RED)
            return 1
        
        print_color(f"\n🔍 Scanning: {path}\n", Colors.CYAN, bold=True)
        
        # Initialize scanner
        scanner = SecretScanner(
            entropy_enabled=include_entropy,
            min_entropy=4.0
        )
        
        start_time = time.time()
        
        # Perform scan
        if path.is_file():
            with open(path, 'r', errors='ignore') as f:
                content = f.read()
            results = scanner.scan_content(content, str(path))
            files_scanned = 1
        else:
            results = scanner.scan_directory(
                str(path),
                include_patterns=['*'],
                exclude_patterns=self.config['ignore_patterns']
            )
            files_scanned = sum(1 for _ in path.rglob('*') if _.is_file())
        
        elapsed = time.time() - start_time
        
        # Filter by severity
        severity_order = ['critical', 'high', 'medium', 'low', 'info']
        min_severity_idx = severity_order.index(severity.lower())
        filtered_results = [
            r for r in results
            if severity_order.index(r.get('risk_level', 'low').lower()) <= min_severity_idx
        ]
        
        # Output results
        if output_format == 'json':
            output = json.dumps({
                'scan_path': str(path),
                'files_scanned': files_scanned,
                'secrets_found': len(filtered_results),
                'duration_seconds': round(elapsed, 2),
                'results': filtered_results
            }, indent=2)
            
            if output_file:
                with open(output_file, 'w') as f:
                    f.write(output)
                print_color(f"Results saved to: {output_file}", Colors.GREEN)
            else:
                print(output)
        
        elif output_format == 'sarif':
            sarif = self._to_sarif(filtered_results, str(path))
            output = json.dumps(sarif, indent=2)
            
            if output_file:
                with open(output_file, 'w') as f:
                    f.write(output)
                print_color(f"SARIF report saved to: {output_file}", Colors.GREEN)
            else:
                print(output)
        
        else:  # table format
            self._print_results_table(filtered_results, files_scanned, elapsed, verbose)
        
        # Summary
        print_color(f"\n{'='*60}", Colors.CYAN)
        print_color(f"📊 Scan Summary", Colors.CYAN, bold=True)
        print_color(f"{'='*60}", Colors.CYAN)
        print(f"   Files scanned: {files_scanned}")
        print(f"   Secrets found: {len(filtered_results)}")
        print(f"   Time elapsed:  {elapsed:.2f}s")
        
        # Risk breakdown
        risk_counts = {}
        for r in filtered_results:
            level = r.get('risk_level', 'low')
            risk_counts[level] = risk_counts.get(level, 0) + 1
        
        if risk_counts:
            print(f"\n   Risk Distribution:")
            for level in ['critical', 'high', 'medium', 'low']:
                if level in risk_counts:
                    print(f"     {format_risk_level(level)}: {risk_counts[level]}")
        
        print_color(f"{'='*60}\n", Colors.CYAN)
        
        # Return exit code based on findings
        if any(r.get('risk_level', '').lower() in ['critical', 'high'] for r in filtered_results):
            return 1
        return 0
    
    def _print_results_table(
        self,
        results: List[Dict],
        files_scanned: int,
        elapsed: float,
        verbose: bool
    ) -> None:
        """Print results in table format."""
        if not results:
            print_color("\n✅ No secrets found!\n", Colors.GREEN, bold=True)
            return
        
        print_color(f"\n⚠️  Found {len(results)} potential secret(s):\n", Colors.YELLOW, bold=True)
        
        if RICH_AVAILABLE and console:
            table = Table(show_header=True, header_style="bold cyan")
            table.add_column("Risk", style="bold", width=10)
            table.add_column("Type", width=20)
            table.add_column("File", width=40)
            table.add_column("Line", width=6, justify="right")
            
            if verbose:
                table.add_column("Preview", width=30)
            
            for result in results:
                risk = result.get('risk_level', 'low').upper()
                risk_style = {
                    'CRITICAL': 'bold red',
                    'HIGH': 'bold yellow',
                    'MEDIUM': 'blue',
                    'LOW': 'green'
                }.get(risk, 'white')
                
                row = [
                    f"[{risk_style}]{risk}[/]",
                    result.get('type', 'Unknown'),
                    result.get('file_path', 'N/A'),
                    str(result.get('line_number', 0))
                ]
                
                if verbose:
                    preview = result.get('masked_value', '')[:30]
                    row.append(preview)
                
                table.add_row(*row)
            
            console.print(table)
        else:
            # Fallback to simple print
            for i, result in enumerate(results, 1):
                risk = format_risk_level(result.get('risk_level', 'low'))
                print(f"\n{i}. {risk}")
                print(f"   Type: {result.get('type', 'Unknown')}")
                print(f"   File: {result.get('file_path', 'N/A')}")
                print(f"   Line: {result.get('line_number', 0)}")
                if verbose:
                    print(f"   Preview: {result.get('masked_value', '')[:50]}")
    
    def _to_sarif(self, results: List[Dict], scan_path: str) -> Dict:
        """Convert results to SARIF format."""
        return {
            "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
            "version": "2.1.0",
            "runs": [{
                "tool": {
                    "driver": {
                        "name": "Vault Sentry",
                        "version": __version__,
                        "informationUri": "https://github.com/secret-sentry/secret-sentry",
                        "rules": []
                    }
                },
                "results": [
                    {
                        "ruleId": r.get('type', 'unknown'),
                        "level": {
                            'critical': 'error',
                            'high': 'error',
                            'medium': 'warning',
                            'low': 'note'
                        }.get(r.get('risk_level', 'low').lower(), 'note'),
                        "message": {
                            "text": f"Potential {r.get('type', 'secret')} detected"
                        },
                        "locations": [{
                            "physicalLocation": {
                                "artifactLocation": {
                                    "uri": r.get('file_path', ''),
                                    "uriBaseId": "%SRCROOT%"
                                },
                                "region": {
                                    "startLine": r.get('line_number', 1),
                                    "startColumn": r.get('column_start', 1)
                                }
                            }
                        }]
                    }
                    for r in results
                ]
            }]
        }
    
    def config_cmd(self, action: str, key: Optional[str] = None, value: Optional[str] = None) -> int:
        """Handle configuration commands."""
        if action == 'show':
            print_color("\n📋 Current Configuration:\n", Colors.CYAN, bold=True)
            print(json.dumps(self.config, indent=2))
            return 0
        
        elif action == 'set':
            if not key or value is None:
                print_color("Error: 'set' requires --key and --value", Colors.RED)
                return 1
            
            # Handle list values
            if key == 'ignore_patterns':
                self.config[key] = value.split(',')
            else:
                self.config[key] = value
            
            self._save_config()
            print_color(f"✅ Set {key} = {value}", Colors.GREEN)
            return 0
        
        elif action == 'path':
            print(self.config_path)
            return 0
        
        elif action == 'reset':
            if self.config_path.exists():
                self.config_path.unlink()
            print_color("✅ Configuration reset to defaults", Colors.GREEN)
            return 0
        
        return 1


def main():
    """Main entry point for the CLI."""
    parser = argparse.ArgumentParser(
        prog='VaultSentry',
        description='Vault Sentry - Detect exposed secrets in your code',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  VaultSentry scan .                    Scan current directory
  VaultSentry scan ./src --verbose      Scan with detailed output
  VaultSentry scan . -f json -o out.json  Export results as JSON
  VaultSentry scan . --severity high    Only show high/critical findings
  VaultSentry config show               Show current configuration
  VaultSentry config set --key api_key --value YOUR_KEY
        """
    )
    
    parser.add_argument(
        '-v', '--version',
        action='version',
        version=f'Vault Sentry v{__version__}'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Scan command
    scan_parser = subparsers.add_parser('scan', help='Scan for secrets')
    scan_parser.add_argument(
        'path',
        nargs='?',
        default='.',
        help='Path to scan (default: current directory)'
    )
    scan_parser.add_argument(
        '-f', '--format',
        choices=['table', 'json', 'sarif'],
        default='table',
        help='Output format (default: table)'
    )
    scan_parser.add_argument(
        '-o', '--output',
        help='Output file path'
    )
    scan_parser.add_argument(
        '-s', '--severity',
        choices=['critical', 'high', 'medium', 'low', 'info'],
        default='low',
        help='Minimum severity to report (default: low)'
    )
    scan_parser.add_argument(
        '--no-entropy',
        action='store_true',
        help='Disable entropy-based detection'
    )
    scan_parser.add_argument(
        '--verbose',
        action='store_true',
        help='Show detailed output'
    )
    scan_parser.add_argument(
        '--no-color',
        action='store_true',
        help='Disable colored output'
    )
    
    # Config command
    config_parser = subparsers.add_parser('config', help='Manage configuration')
    config_parser.add_argument(
        'action',
        choices=['show', 'set', 'path', 'reset'],
        help='Configuration action'
    )
    config_parser.add_argument('--key', help='Configuration key')
    config_parser.add_argument('--value', help='Configuration value')
    
    # Parse arguments
    args = parser.parse_args()
    
    if not args.command:
        print_banner()
        parser.print_help()
        return 0
    
    cli = VaultSentryCLI()
    
    if args.command == 'scan':
        print_banner()
        return cli.scan(
            path=args.path,
            output_format=args.format,
            severity=args.severity,
            include_entropy=not args.no_entropy,
            output_file=args.output,
            verbose=args.verbose,
            no_color=args.no_color
        )
    
    elif args.command == 'config':
        return cli.config_cmd(
            action=args.action,
            key=args.key,
            value=args.value
        )
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
