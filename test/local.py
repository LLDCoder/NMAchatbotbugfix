#!/usr/bin/env python3
"""Local development entry point. Never initializes or starts a debug environment."""
import argparse
import sys

import env


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['init', 'up', 'down', 'restart', 'status', 'check', 'build', 'portal'])
    args = parser.parse_args()
    sys.argv = [sys.argv[0], args.command, 'local']
    env.main()


if __name__ == '__main__':
    main()
