# Netlify Monorepo Deployment Configuration

## Status

**Phase:** Implementation

## Overview

Establish scalable Netlify deployment configuration for multiple web editors in the audiocontrol monorepo. Includes renaming the Roland sampler editor module and Netlify site to reflect multi-device support.

## Documentation

- [PRD](./prd.md) - Product requirements
- [Workplan](./workplan.md) - Implementation plan

## Tracking

- **Milestone:** TBD
- **Parent Issue:** TBD

## Changes Summary

| Before | After |
|--------|-------|
| `modules/sampler-editor` | `modules/roland-sxx0-editor` |
| Netlify site: `s330` | Netlify site: `roland-sxx0-editor` |
| `deploy/s330-editor` branch | `deploy/roland-sxx0-editor` branch |
| `modules/sampler-editor/netlify.toml` | `netlify/roland-sxx0-editor/_redirects`, `_headers` |
