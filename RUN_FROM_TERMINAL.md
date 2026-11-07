# OyaCheck v0.9 — Ubuntu / Zsh setup

The archive contains the application files at the ZIP root, ready to extract into your existing `official-link-agent` folder. OyaCheck is the product name; keep the directory name unchanged for now.

## Install without losing your previous version

```zsh
cd ~/Desktop/celo
cp -a official-link-agent "official-link-agent-backup-$(date +%Y%m%d-%H%M%S)"
unzip -o ~/Downloads/oyacheck-v9-auto-stop.zip -d official-link-agent
cd official-link-agent
npm run check
npm test
```

## Start locally with your existing Groq API key

Stop the previous server using Ctrl+C, then:

```zsh
cd ~/Desktop/celo/official-link-agent
read -rs 'GROQ_API_KEY?Groq API key: '
echo
export GROQ_API_KEY
npm run dev
```

Open `http://localhost:4173`, refresh with `Ctrl+Shift+R` and allow microphone access only if you choose to use voice.

## Hands-free test

1. Keep **Auto-send voice questions** and **Speak answers** checked.
2. Tap **Speak**, say “How can I tell if this website is fake?”, and **stop talking without tapping Stop**.
3. After roughly 1.5 seconds of silence, the recording should stop automatically, transcribe, submit to Groq and read the answer aloud.
4. Switch to Pidgin and ask “Abeg how I go know say this link na scam?”; listen for speech quality and check the transcript.
5. Dictate a domain such as `example.org` — the text should stay editable for confirmation. No automatic URL submission.
6. Test a silent recording: it should stop without sending an empty question. Stop remains available if the automatic detector struggles in a noisy room.

Transcription and chat requests use Groq's allowance and may fall back to clearly labelled offline text. **This voice test makes no Celo payment.** Browser voice playback depends on installed voices; use Listen if autoplay is blocked.

The separate Celo Buy source-inspection feature remains sandbox-only, local-only, disabled unless explicitly enabled with `BUY_BROWSER_SANDBOX=1`, and requires purchase confirmation. Do not turn it on while testing voice.

Never send private API keys, wallet credentials or personal documents in screenshots. The project does not store audio, but the transcription provider processes it.
