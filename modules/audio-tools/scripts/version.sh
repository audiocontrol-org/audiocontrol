#!/usr/bin/env bash

# version.sh - Semver version management with pre-release support
#
# Usage:
#   ./scripts/version.sh major           # 1.0.0 → 2.0.0
#   ./scripts/version.sh minor           # 1.0.0 → 1.1.0
#   ./scripts/version.sh patch           # 1.0.0 → 1.0.1
#   ./scripts/version.sh alpha           # 1.0.0-alpha.1 → 1.0.0-alpha.2
#   ./scripts/version.sh beta            # 1.0.0-beta.1 → 1.0.0-beta.2
#   ./scripts/version.sh promote-alpha   # 1.0.0 → 1.0.0-alpha.1
#   ./scripts/version.sh promote-beta    # 1.0.0-alpha.5 → 1.0.0-beta.1
#   ./scripts/version.sh release         # 1.0.0-beta.3 → 1.0.0
#   ./scripts/version.sh set VERSION     # Set explicit version

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project root (script location parent)
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Check for jq
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is required but not installed${NC}"
    echo "Install with: brew install jq"
    exit 1
fi

# Get current version from root package.json
get_current_version() {
    jq -r '.version' "$PROJECT_ROOT/package.json"
}

# Parse version into components
parse_version() {
    local version="$1"

    # Extract base version (x.y.z) and prerelease (alpha.N or beta.N)
    if [[ "$version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-([a-z]+)\.([0-9]+))?$ ]]; then
        MAJOR="${BASH_REMATCH[1]}"
        MINOR="${BASH_REMATCH[2]}"
        PATCH="${BASH_REMATCH[3]}"
        PRERELEASE="${BASH_REMATCH[5]:-}"  # alpha or beta
        PRERELEASE_NUM="${BASH_REMATCH[6]:-0}"
    else
        echo -e "${RED}Error: Invalid version format: $version${NC}"
        exit 1
    fi
}

# Bump version based on type
bump_version() {
    local bump_type="$1"
    local current_version
    current_version="$(get_current_version)"

    parse_version "$current_version"

    local new_version=""

    case "$bump_type" in
        major)
            new_version="$((MAJOR + 1)).0.0"
            ;;
        minor)
            new_version="${MAJOR}.$((MINOR + 1)).0"
            ;;
        patch)
            new_version="${MAJOR}.${MINOR}.$((PATCH + 1))"
            ;;
        alpha)
            if [[ "$PRERELEASE" == "alpha" ]]; then
                # Already in alpha, bump the number
                new_version="${MAJOR}.${MINOR}.${PATCH}-alpha.$((PRERELEASE_NUM + 1))"
            else
                echo -e "${RED}Error: Not in alpha prerelease. Use 'promote-alpha' first${NC}"
                exit 1
            fi
            ;;
        beta)
            if [[ "$PRERELEASE" == "beta" ]]; then
                # Already in beta, bump the number
                new_version="${MAJOR}.${MINOR}.${PATCH}-beta.$((PRERELEASE_NUM + 1))"
            else
                echo -e "${RED}Error: Not in beta prerelease. Use 'promote-beta' first${NC}"
                exit 1
            fi
            ;;
        promote-alpha)
            if [[ -n "$PRERELEASE" ]]; then
                echo -e "${YELLOW}Warning: Already in prerelease ($PRERELEASE.$PRERELEASE_NUM). Starting new alpha cycle.${NC}"
            fi
            new_version="${MAJOR}.${MINOR}.${PATCH}-alpha.1"
            ;;
        promote-beta)
            # Promote from any state to beta.1
            new_version="${MAJOR}.${MINOR}.${PATCH}-beta.1"
            ;;
        release)
            if [[ -z "$PRERELEASE" ]]; then
                echo -e "${RED}Error: Not in prerelease. Already at stable version $current_version${NC}"
                exit 1
            fi
            new_version="${MAJOR}.${MINOR}.${PATCH}"
            ;;
        set)
            # Explicit version set (validated by caller)
            new_version="$2"
            ;;
        *)
            echo -e "${RED}Error: Unknown bump type: $bump_type${NC}"
            usage
            exit 1
            ;;
    esac

    echo "$new_version"
}

# Get all workspace packages
get_workspace_packages() {
    local packages=()

    # Parse pnpm-workspace.yaml to get package directories
    while IFS= read -r line; do
        # Extract package pattern (- 'package-name')
        if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*[\'\"]*([^\'\"#]+)[\'\"#]* ]]; then
            local pkg_pattern="${BASH_REMATCH[1]}"
            pkg_pattern="${pkg_pattern%"${pkg_pattern##*[![:space:]]}"}" # Trim trailing whitespace

            # Check if directory exists
            if [[ -d "$PROJECT_ROOT/$pkg_pattern" ]]; then
                packages+=("$pkg_pattern")
            fi
        fi
    done < "$PROJECT_ROOT/pnpm-workspace.yaml"

    printf '%s\n' "${packages[@]}"
}

# Update package.json version
update_package_version() {
    local package_json="$1"
    local new_version="$2"

    # Use jq to update version and preserve formatting
    local tmp_file
    tmp_file=$(mktemp)
    jq --arg version "$new_version" '.version = $version' "$package_json" > "$tmp_file"
    mv "$tmp_file" "$package_json"
}

# Check if package should be skipped
should_skip_package() {
    local package_json="$1"

    # Skip if private: true
    local is_private
    is_private=$(jq -r '.private // false' "$package_json")

    if [[ "$is_private" == "true" ]]; then
        return 0  # Skip
    fi

    return 1  # Don't skip
}

# Update all packages
update_all_packages() {
    local new_version="$1"
    local current_version
    current_version="$(get_current_version)"

    echo -e "${BLUE}Version Update${NC}"
    echo -e "  ${YELLOW}From:${NC} $current_version"
    echo -e "  ${YELLOW}To:${NC}   $new_version"
    echo ""

    # Update root package.json
    echo -e "${GREEN}Updating packages:${NC}"
    update_package_version "$PROJECT_ROOT/package.json" "$new_version"
    echo "  ✓ package.json (root)"

    # Update workspace packages
    while IFS= read -r pkg_dir; do
        local package_json="$PROJECT_ROOT/$pkg_dir/package.json"

        if [[ ! -f "$package_json" ]]; then
            echo -e "  ${YELLOW}⚠${NC} $pkg_dir/package.json (not found)"
            continue
        fi

        if should_skip_package "$package_json"; then
            local pkg_name
            pkg_name=$(jq -r '.name' "$package_json")
            echo -e "  ${YELLOW}⊘${NC} $pkg_dir ($pkg_name - private, skipped)"
            continue
        fi

        update_package_version "$package_json" "$new_version"
        local pkg_name
        pkg_name=$(jq -r '.name' "$package_json")
        echo "  ✓ $pkg_dir ($pkg_name)"
    done < <(get_workspace_packages)

    echo ""
}

# Update lockfile
update_lockfile() {
    echo -e "${GREEN}Updating lockfile:${NC}"

    cd "$PROJECT_ROOT"
    if pnpm install --lockfile-only --no-frozen-lockfile; then
        echo "  ✓ pnpm-lock.yaml updated"
    else
        echo -e "  ${RED}✗ Failed to update lockfile${NC}"
        exit 1
    fi

    echo ""
}

# Verify versions
verify_versions() {
    local expected_version="$1"

    echo -e "${GREEN}Verifying versions:${NC}"

    local all_correct=true

    # Check root
    local root_version
    root_version=$(jq -r '.version' "$PROJECT_ROOT/package.json")
    if [[ "$root_version" == "$expected_version" ]]; then
        echo "  ✓ package.json: $root_version"
    else
        echo -e "  ${RED}✗ package.json: $root_version (expected $expected_version)${NC}"
        all_correct=false
    fi

    # Check workspace packages
    while IFS= read -r pkg_dir; do
        local package_json="$PROJECT_ROOT/$pkg_dir/package.json"

        if [[ ! -f "$package_json" ]]; then
            continue
        fi

        if should_skip_package "$package_json"; then
            continue
        fi

        local pkg_version
        pkg_version=$(jq -r '.version' "$package_json")
        local pkg_name
        pkg_name=$(jq -r '.name' "$package_json")

        if [[ "$pkg_version" == "$expected_version" ]]; then
            echo "  ✓ $pkg_name: $pkg_version"
        else
            echo -e "  ${RED}✗ $pkg_name: $pkg_version (expected $expected_version)${NC}"
            all_correct=false
        fi
    done < <(get_workspace_packages)

    echo ""

    if [[ "$all_correct" == "false" ]]; then
        echo -e "${RED}Version verification failed!${NC}"
        exit 1
    fi
}

# Usage information
usage() {
    cat << EOF
Usage: $0 <command> [options]

Commands:
  major              Bump major version (1.0.0 → 2.0.0)
  minor              Bump minor version (1.0.0 → 1.1.0)
  patch              Bump patch version (1.0.0 → 1.0.1)

  alpha              Bump alpha prerelease (1.0.0-alpha.1 → 1.0.0-alpha.2)
  beta               Bump beta prerelease (1.0.0-beta.1 → 1.0.0-beta.2)

  promote-alpha      Promote to alpha prerelease (1.0.0 → 1.0.0-alpha.1)
  promote-beta       Promote to beta prerelease (1.0.0-alpha.5 → 1.0.0-beta.1)
  release            Release from prerelease (1.0.0-beta.3 → 1.0.0)

  set VERSION        Set explicit version (e.g., set 2.0.0-rc.1)

Examples:
  $0 patch                    # Bump patch: 1.0.0 → 1.0.1
  $0 promote-alpha            # Start alpha: 1.0.0 → 1.0.0-alpha.1
  $0 alpha                    # Bump alpha: 1.0.0-alpha.1 → 1.0.0-alpha.2
  $0 promote-beta             # Move to beta: 1.0.0-alpha.5 → 1.0.0-beta.1
  $0 release                  # Release: 1.0.0-beta.3 → 1.0.0
  $0 set 1.0.0-alpha.1        # Set explicit version

Notes:
  - Skips private packages (sampler-attic)
  - Updates pnpm-lock.yaml automatically
  - Verifies all versions after update
EOF
}

# Main execution
main() {
    local command="${1:-}"

    if [[ -z "$command" ]]; then
        usage
        exit 1
    fi

    if [[ "$command" == "help" ]] || [[ "$command" == "--help" ]] || [[ "$command" == "-h" ]]; then
        usage
        exit 0
    fi

    # Calculate new version
    local new_version
    if [[ "$command" == "set" ]]; then
        new_version="${2:-}"
        if [[ -z "$new_version" ]]; then
            echo -e "${RED}Error: 'set' command requires a version argument${NC}"
            usage
            exit 1
        fi
        # Validate version format
        parse_version "$new_version"
    else
        new_version=$(bump_version "$command" "${2:-}")
    fi

    # Perform the update
    update_all_packages "$new_version"
    update_lockfile
    verify_versions "$new_version"

    echo -e "${GREEN}✓ Successfully updated to version $new_version${NC}"
}

main "$@"
