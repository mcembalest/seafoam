#!/usr/bin/env python3
"""
Setup script for state-graph-scanner navigation system.
"""
from setuptools import setup, find_packages

setup(
    name="state-graph-navigator",
    version="1.0.0",
    description="AI-powered navigation for state-action graphs",
    packages=find_packages(),
    install_requires=[
        "claude-agent-sdk>=0.1.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-asyncio>=0.21.0",
        ],
        "interactive": [
            "prompt-toolkit>=3.0.0",
            "rich>=13.0.0",
        ]
    },
    entry_points={
        "console_scripts": [
            "app-guide=guide:main",
        ],
    },
    python_requires=">=3.9",
)
