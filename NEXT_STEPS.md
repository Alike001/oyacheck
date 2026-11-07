# Celo Official Link Agent — Step 2

These files do not overwrite your existing `check.mjs`.

## Install from Ubuntu terminal

Download `celo-step2.zip` from the ChatGPT message to your Downloads folder, then:

    cd ~/Desktop/celo
    unzip -n ~/Downloads/celo-step2.zip -d official-link-agent
    node --check official-link-agent/explain.mjs
    node official-link-agent/test-explain.mjs

## Run offline

    node official-link-agent/explain.mjs secure-verifymydevice.ng --no-ai

## Run with optional free Groq explanation

Under Zsh, enter the secret without echo:

    read -rs 'GROQ_API_KEY?Groq key: '
    echo
    export GROQ_API_KEY
    node official-link-agent/explain.mjs secure-verifymydevice.ng --lang=pidgin
    unset GROQ_API_KEY

The secret is not written to a file. This CLI never opens the URL or performs a Celo payment.
The browser integration is deliberately not called yet; safety hardening is required.

An `official-domain-match` only identifies a documented hostname; it does not prove an individual page is safe.
For unknown domains the tool returns `unverified`, not `safe`.

The test suite includes five cases, including HTTP and unusual-port inputs.
