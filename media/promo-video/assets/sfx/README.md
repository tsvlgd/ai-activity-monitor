# Sound effects

All files are original, synthesized with ffmpeg 6.1.1 (aevalsrc, anoisesrc). No samples or third party audio, so there are no licensing restrictions. Format: WAV, 48 kHz, stereo, 16 bit PCM.

| File | Duration | Peak (volumedetect max_volume) | Use |
| --- | --- | --- | --- |
| pop.wav | 0.100 s | -12.0 dBFS | icons and bubbles appearing |
| click.wav | 0.040 s | -12.0 dBFS | mouse click |
| whoosh.wav | 0.350 s | -12.0 dBFS | window slide |
| bump.wav | 0.120 s | -12.0 dBFS | two tiles colliding |
| ding.wav | 0.600 s | -12.0 dBFS | notification chime (C6 then E6) |
| bed.wav | 50.000 s | -22.7 dBFS, integrated -28.0 LUFS | ambient pad under the voiceover |

## How they were made

Each sound was rendered once, its peak measured with `volumedetect`, then rendered again with a fixed `volume` gain so the peak lands at -12 dBFS. The bed was normalised the same way against an `ebur128` integrated loudness target of -28 LUFS. Every sound ends in an `afade` (and attacks are shaped with a `1-exp(-k*t)` envelope) so there are no clicks. The commands below are the exact final commands, run from this folder.

The bed is four chords (Cmaj7, Am7, Fmaj7, G6), each a stack of sines plus a quiet octave, detuned slightly between left and right for width, with a slow tremolo. Chords start every 12.5 s with 4 s fade in and 5 s fade out so they crossfade, then pass through two low pass filters and a soft echo. The last 3 s fade to silence, so it loops cleanly from silence.

### pop

```bash
ffmpeg -y -filter_complex "aevalsrc=exprs='sin(2*PI*(400*t+500*(1-exp(-40*t))/40))*exp(-30*t)*(1-exp(-t*3000))':s=48000:d=0.1,lowpass=f=5000,afade=t=out:st=0.085:d=0.015,aformat=channel_layouts=stereo,volume=-8.5dB[out]" -map "[out]" -ar 48000 -ac 2 -c:a pcm_s16le pop.wav
```

### click

```bash
ffmpeg -y -filter_complex "aevalsrc=exprs='((random(0)*2-1)*0.6*exp(-t*400)+0.5*sin(2*PI*2400*t)*exp(-t*220))*(1-exp(-t*8000))':s=48000:d=0.04,highpass=f=600,lowpass=f=9000,afade=t=out:st=0.03:d=0.01,aformat=channel_layouts=stereo,volume=-5.8dB[out]" -map "[out]" -ar 48000 -ac 2 -c:a pcm_s16le click.wav
```

### whoosh

```bash
ffmpeg -y -filter_complex "anoisesrc=d=0.35:c=pink:r=48000:a=0.6:seed=7,asplit=2[n1][n2];[n1]lowpass=f=450,lowpass=f=450[lo];[n2]bandpass=f=2400:width_type=q:w=0.9[hi];aevalsrc=exprs='pow(sin(PI*t/0.35),2)*(1-t/0.35)':s=48000:d=0.35[e1];aevalsrc=exprs='pow(sin(PI*t/0.35),2)*(t/0.35)':s=48000:d=0.35[e2];[lo][e1]amultiply[a];[hi][e2]amultiply[b];[a][b]amix=inputs=2:normalize=0,afade=t=in:d=0.01,afade=t=out:st=0.33:d=0.02,aformat=channel_layouts=stereo,volume=9.2dB[out]" -map "[out]" -ar 48000 -ac 2 -c:a pcm_s16le whoosh.wav
```

### bump

```bash
ffmpeg -y -filter_complex "aevalsrc=exprs='(sin(2*PI*(55*t+65*(1-exp(-30*t))/30))*exp(-28*t)+0.15*(random(0)*2-1)*exp(-t*90))*(1-exp(-t*1500))':s=48000:d=0.12,lowpass=f=700,afade=t=out:st=0.1:d=0.02,aformat=channel_layouts=stereo,volume=-7.9dB[out]" -map "[out]" -ar 48000 -ac 2 -c:a pcm_s16le bump.wav
```

### ding

```bash
ffmpeg -y -filter_complex "aevalsrc=exprs='0.35*((sin(2*PI*1046.5*t)+0.25*sin(2*PI*2093*t))*exp(-6*t)*(1-exp(-t*600))+gte(t,0.12)*(sin(2*PI*1318.5*(t-0.12))+0.25*sin(2*PI*2637*(t-0.12)))*exp(-6*(t-0.12))*(1-exp(-(t-0.12)*600)))':s=48000:d=0.6,lowpass=f=6000,afade=t=out:st=0.5:d=0.1,aformat=channel_layouts=stereo,volume=-3.5dB[out]" -map "[out]" -ar 48000 -ac 2 -c:a pcm_s16le ding.wav
```

### bed

```bash
ffmpeg -y -filter_complex "aevalsrc=exprs='(sin(2*PI*130.81*0.998*t)+0.3*sin(2*PI*130.81*2*t)+sin(2*PI*164.81*0.998*t)+0.3*sin(2*PI*164.81*2*t)+sin(2*PI*196.00*0.998*t)+0.3*sin(2*PI*196.00*2*t)+sin(2*PI*246.94*0.998*t)+0.3*sin(2*PI*246.94*2*t))*(0.85+0.15*sin(2*PI*0.2*t))|(sin(2*PI*130.81*1.002*t)+0.3*sin(2*PI*130.81*2*t)+sin(2*PI*164.81*1.002*t)+0.3*sin(2*PI*164.81*2*t)+sin(2*PI*196.00*1.002*t)+0.3*sin(2*PI*196.00*2*t)+sin(2*PI*246.94*1.002*t)+0.3*sin(2*PI*246.94*2*t))*(0.85+0.15*sin(2*PI*0.23*t))':s=48000:d=16,afade=t=in:d=4,afade=t=out:st=11:d=5[c1];aevalsrc=exprs='(sin(2*PI*110.00*0.998*t)+0.3*sin(2*PI*110.00*2*t)+sin(2*PI*130.81*0.998*t)+0.3*sin(2*PI*130.81*2*t)+sin(2*PI*164.81*0.998*t)+0.3*sin(2*PI*164.81*2*t)+sin(2*PI*196.00*0.998*t)+0.3*sin(2*PI*196.00*2*t))*(0.85+0.15*sin(2*PI*0.2*t))|(sin(2*PI*110.00*1.002*t)+0.3*sin(2*PI*110.00*2*t)+sin(2*PI*130.81*1.002*t)+0.3*sin(2*PI*130.81*2*t)+sin(2*PI*164.81*1.002*t)+0.3*sin(2*PI*164.81*2*t)+sin(2*PI*196.00*1.002*t)+0.3*sin(2*PI*196.00*2*t))*(0.85+0.15*sin(2*PI*0.23*t))':s=48000:d=16,afade=t=in:d=4,afade=t=out:st=11:d=5[c2];aevalsrc=exprs='(sin(2*PI*87.31*0.998*t)+0.3*sin(2*PI*87.31*2*t)+sin(2*PI*130.81*0.998*t)+0.3*sin(2*PI*130.81*2*t)+sin(2*PI*174.61*0.998*t)+0.3*sin(2*PI*174.61*2*t)+sin(2*PI*220.00*0.998*t)+0.3*sin(2*PI*220.00*2*t))*(0.85+0.15*sin(2*PI*0.2*t))|(sin(2*PI*87.31*1.002*t)+0.3*sin(2*PI*87.31*2*t)+sin(2*PI*130.81*1.002*t)+0.3*sin(2*PI*130.81*2*t)+sin(2*PI*174.61*1.002*t)+0.3*sin(2*PI*174.61*2*t)+sin(2*PI*220.00*1.002*t)+0.3*sin(2*PI*220.00*2*t))*(0.85+0.15*sin(2*PI*0.23*t))':s=48000:d=16,afade=t=in:d=4,afade=t=out:st=11:d=5[c3];aevalsrc=exprs='(sin(2*PI*98.00*0.998*t)+0.3*sin(2*PI*98.00*2*t)+sin(2*PI*146.83*0.998*t)+0.3*sin(2*PI*146.83*2*t)+sin(2*PI*196.00*0.998*t)+0.3*sin(2*PI*196.00*2*t)+sin(2*PI*246.94*0.998*t)+0.3*sin(2*PI*246.94*2*t))*(0.85+0.15*sin(2*PI*0.2*t))|(sin(2*PI*98.00*1.002*t)+0.3*sin(2*PI*98.00*2*t)+sin(2*PI*146.83*1.002*t)+0.3*sin(2*PI*146.83*2*t)+sin(2*PI*196.00*1.002*t)+0.3*sin(2*PI*196.00*2*t)+sin(2*PI*246.94*1.002*t)+0.3*sin(2*PI*246.94*2*t))*(0.85+0.15*sin(2*PI*0.23*t))':s=48000:d=16,afade=t=in:d=4,afade=t=out:st=11:d=5[c4];[c2]adelay=12500|12500[d2];[c3]adelay=25000|25000[d3];[c4]adelay=37500|37500[d4];[c1][d2][d3][d4]amix=inputs=4:normalize=0:duration=longest,lowpass=f=900,lowpass=f=1400,aecho=0.8:0.6:180|330:0.25|0.18,atrim=0:50,afade=t=in:d=2,afade=t=out:st=47:d=3,volume=-22.7dB[out]" -map "[out]" -ar 48000 -ac 2 -c:a pcm_s16le bed.wav
```

## Verify

```bash
ffprobe -v error -show_entries stream=duration,sample_rate,channels -of csv=p=0 pop.wav
ffmpeg -i pop.wav -af volumedetect -f null -
ffmpeg -i bed.wav -af ebur128 -f null -
```
