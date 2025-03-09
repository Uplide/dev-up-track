#!/bin/bash

source .env

escape_regex() {
    local regex="$1"
    echo "$regex" | sed -e 's/[]\/$*.^|[]/\\&/g'
}

declare -a variables=(
    NODE_ENV
    VITE_LINEAR_API_KEY
    VITE_TEAM_ID
)

for variable in "${variables[@]}"
do
    echo $variable
    find . -type d -name "node_modules" -prune -o -type f \( -name "*.html" -o -name "*.js" -o -name "*.json" \) -print | while read file; do

        temp_file=$(mktemp)
        escaped=$(escape_regex "${!variable}")
        sed "s/${variable}_CHANGE_ME/$escaped/g" "$file" > "$temp_file"

        mv "$temp_file" "$file"
        chmod +rw $file
        echo "File: '$file' updated for env"
    done
    echo "Written env: $variable"
done