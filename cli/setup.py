#!/usr/bin/env python3
"""
Vault Sentry CLI Setup
=======================
Package configuration for the Vault Sentry command-line tool.
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read README
readme_path = Path(__file__).parent.parent / 'README.md'
long_description = ''
if readme_path.exists():
    long_description = readme_path.read_text(encoding='utf-8')

setup(
    name='VaultSentry',
    version='1.0.0',
    author='Vault Sentry Team',
    author_email='team@VaultSentry.io',
    description='Detect exposed secrets in code repositories',
    long_description=long_description,
    long_description_content_type='text/markdown',
    url='https://github.com/secret-sentry/secret-sentry',
    project_urls={
        'Bug Tracker': 'https://github.com/secret-sentry/secret-sentry/issues',
        'Documentation': 'https://docs.VaultSentry.io',
        'Source': 'https://github.com/secret-sentry/secret-sentry',
    },
    license='MIT',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Console',
        'Intended Audience :: Developers',
        'Intended Audience :: Information Technology',
        'Intended Audience :: System Administrators',
        'License :: OSI Approved :: MIT License',
        'Operating System :: OS Independent',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.9',
        'Programming Language :: Python :: 3.10',
        'Programming Language :: Python :: 3.11',
        'Programming Language :: Python :: 3.12',
        'Topic :: Security',
        'Topic :: Software Development :: Quality Assurance',
        'Topic :: Software Development :: Testing',
    ],
    keywords='security secrets detection scanning cli devops devsecops',
    packages=find_packages(),
    python_requires='>=3.9',
    install_requires=[
        'rich>=13.0.0',
        'requests>=2.28.0',
    ],
    extras_require={
        'dev': [
            'pytest>=7.0.0',
            'pytest-cov>=4.0.0',
            'black>=23.0.0',
            'isort>=5.12.0',
            'mypy>=1.0.0',
        ],
    },
    entry_points={
        'console_scripts': [
            'VaultSentry=VaultSentry:main',
        ],
    },
    include_package_data=True,
    zip_safe=False,
)
