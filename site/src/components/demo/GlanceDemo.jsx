// The hero demo: a GNOME desktop where GlanceAgent runs on the extension's
// real core. It plays a short tour on its own, stops the moment the visitor
// touches anything, and pauses while it is off screen.
import {useCallback, useEffect, useReducer, useRef, useState} from 'react';
import {AGENTS, DemoEngine, LOG_LINES, SAYINGS, State, STATE_LABEL, agentOf, formatAgo, formatDuration, motionFor} from './engine.js';
import './demo.css';

const TOUR = [
  [2600, (e, ui) => ui.openCard('claude-code')],
  [2800, (e, ui) => ui.openTerminal('claude-code')],
  [1600, (e) => e.approve('claude-code')],
  [2600, (e) => e.ask('opencode')],
  [3200, (e, ui) => ui.openCard('opencode')],
  [2600, (e, ui) => ui.dismiss('opencode')],
  [1600, (e) => e.approve('opencode')],
  [3800, (e) => e.start('claude-code')],
  [2600, (e) => e.fail('claude-code')],
  [4200, (e, ui) => { ui.closeCard(); e.reset(); }],
  [900, (e) => e.start('claude-code')],
  [1200, (e, ui) => { ui.selectTab('opencode'); e.start('opencode'); }],
];

function Motion({mode, token, amp, children}) {
  // A new attention episode (token) restarts the four hops.
  return <span className={`ga-m ga-m-${mode}`} style={{'--amp': `${amp}px`}} key={mode === 'attention' ? `a${token}` : mode}>{children}</span>;
}

export default function GlanceDemo({base = '/'}) {
  const [, rerender] = useReducer((x) => x + 1, 0);
  const engine = useRef(null);
  if (!engine.current) engine.current = new DemoEngine();
  const e = engine.current;

  const [card, setCard] = useState(null); // {provider, left, notch, from}
  const [tab, setTab] = useState('claude-code');
  const [winOpen, setWinOpen] = useState(true);
  const [toast, setToast] = useState(null);
  const [bubbles, setBubbles] = useState({});
  const [tour, setTour] = useState('playing'); // playing | paused
  const [announce, setAnnounce] = useState('');
  const [prompt, setPrompt] = useState('');

  const stageRef = useRef(null);
  const iconRefs = useRef({});
  const tileRefs = useRef({});
  const tourIdx = useRef(0);
  const tourTimer = useRef(0);
  const visible = useRef(true);
  const lastStates = useRef({});
  const bubbleTimers = useRef({});
  const toastTimer = useRef(0);

  const say = useCallback((provider, text, ms = 2600) => {
    setBubbles((b) => ({...b, [provider]: text}));
    clearTimeout(bubbleTimers.current[provider]);
    bubbleTimers.current[provider] = setTimeout(() => setBubbles((b) => ({...b, [provider]: null})), ms);
  }, []);

  // Wire the engine after mount, so the server render stays pure.
  useEffect(() => {
    for (const [p, agg] of e.aggregates()) lastStates.current[p] = agg.state;
    e.onChange = () => {
      for (const [p, agg] of e.aggregates()) {
        const prev = lastStates.current[p];
        if (prev !== agg.state) {
          lastStates.current[p] = agg.state;
          if (SAYINGS[agg.state] && !agg.acknowledged) say(p, SAYINGS[agg.state]);
          setAnnounce(`${agentOf(p).name}: ${STATE_LABEL[agg.state]}`);
        }
      }
      rerender();
    };
    e.onNotify = (n) => {
      setToast(n);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 5200);
    };
    e.startClock();
    const tick = setInterval(rerender, 1000);
    return () => { clearInterval(tick); e.dispose(); clearTimeout(tourTimer.current); };
  }, [e, say]);

  const measure = (el) => {
    const stage = stageRef.current;
    if (!el || !stage) return null;
    const s = stage.getBoundingClientRect(), r = el.getBoundingClientRect();
    return {x: r.left - s.left + r.width / 2, y: r.top - s.top, w: s.width, h: s.height, rw: r.width, rh: r.height};
  };

  const openCard = useCallback((provider, from = 'bar') => {
    const m = measure(from === 'bar' ? iconRefs.current[provider] : tileRefs.current[provider]);
    if (!m) return setCard({provider, left: 8, notch: null, from});
    const cw = Math.min(340, m.w - 16);
    if (from === 'bar') {
      const left = Math.max(8, Math.min(m.x - cw / 2, m.w - cw - 8));
      setCard({provider, left, top: 42, notch: m.x - left, from});
    } else {
      const toLeft = m.x > m.w / 2;
      const left = Math.max(8, Math.min(toLeft ? m.x - m.rw / 2 - cw - 10 : m.x + m.rw / 2 + 10, m.w - cw - 8));
      setCard({provider, left, top: Math.max(42, Math.min(m.y - 4, m.h - 300)), notch: null, from});
    }
  }, []);
  const closeCard = useCallback(() => setCard(null), []);
  const dismiss = useCallback((provider) => { e.acknowledge(provider); setCard(null); }, [e]);
  const selectTab = useCallback((provider) => setTab(provider), []);
  const openTerminal = useCallback((provider) => {
    setCard(null);
    setTab(provider);
    setWinOpen(true);
    e.acknowledge(provider);
  }, [e]);
  const ui = {openCard, closeCard, dismiss, openTerminal, selectTab};
  const uiRef = useRef(ui);
  uiRef.current = ui;

  // The tour: one timer at a time, so pausing is a single clearTimeout.
  const schedule = useCallback(() => {
    clearTimeout(tourTimer.current);
    if (!visible.current) return;
    const [delay, step] = TOUR[tourIdx.current % TOUR.length];
    tourTimer.current = setTimeout(() => {
      step(engine.current, uiRef.current);
      tourIdx.current = (tourIdx.current + 1) % TOUR.length;
      schedule();
    }, delay);
  }, []);

  useEffect(() => {
    if (tour === 'playing') schedule();
    else clearTimeout(tourTimer.current);
    return () => clearTimeout(tourTimer.current);
  }, [tour, schedule]);

  // Pause while off screen or in a background tab.
  useEffect(() => {
    const stage = stageRef.current;
    const update = (v) => {
      visible.current = v && !document.hidden;
      if (!visible.current) clearTimeout(tourTimer.current);
      else if (tour === 'playing') schedule();
    };
    const io = new IntersectionObserver(([entry]) => update(entry.isIntersecting), {threshold: 0.15});
    if (stage) io.observe(stage);
    const onVis = () => update(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); };
  }, [tour, schedule]);

  // Any touch, click or key inside the demo hands control to the visitor.
  const takeOver = (ev) => {
    if (ev.target.closest?.('[data-tour-toggle]')) return;
    if (tour === 'playing') setTour('paused');
  };
  const replay = () => {
    if (tour === 'playing') return setTour('paused');
    e.reset();
    setCard(null);
    setWinOpen(true);
    setTab('claude-code');
    e.start('claude-code');
    setTimeout(() => e.start('opencode'), 1200);
    tourIdx.current = 0;
    setTour('playing');
  };

  useEffect(() => {
    const onKey = (ev) => { if (ev.key === 'Escape') setCard(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const aggs = e.aggregates();
  const now = e.now();
  const logo = (a) => `${base}${a.logo}`;
  const cardAgent = card && agentOf(card.provider);
  const cardSession = card && e.session(card.provider);
  const tabAgent = agentOf(tab);
  const tabSession = e.session(tab);
  const transcript = e.transcript.get(tab);

  const submitPrompt = (ev) => {
    ev.preventDefault();
    const text = prompt.trim() || tabAgent.task;
    e.start(tab, text.slice(0, 120));
    setPrompt('');
  };

  return (
    <div className="ga" onPointerDownCapture={takeOver} onKeyDownCapture={takeOver}>
      <div className="ga-stage" ref={stageRef} role="region" aria-label="GlanceAgent demo desktop">
        <div className="ga-bar">
          <span className="ga-ws" aria-hidden="true"><i /><i /><i /></span>
          <span className="ga-clock" aria-hidden="true">Tue 24 Nov&ensp;10:42</span>
          <span className="ga-bar-right">
            {AGENTS.map((a) => {
              const agg = aggs.get(a.provider);
              return (
                <button key={a.provider} type="button" ref={(el) => { iconRefs.current[a.provider] = el; }}
                  className={`ga-pi is-${agg?.state ?? 'idle'}${card?.provider === a.provider && card.from === 'bar' ? ' is-open' : ''}`}
                  aria-label={`${a.name}: ${STATE_LABEL[agg?.state ?? 'idle']}. Open preview`}
                  aria-expanded={card?.provider === a.provider}
                  onClick={() => (card?.provider === a.provider ? setCard(null) : openCard(a.provider, 'bar'))}>
                  <Motion mode={motionFor(agg)} token={agg?.attentionSince} amp={3}><img src={logo(a)} alt="" width="18" height="18" /></Motion>
                  <i className="dot" />
                  {bubbles[a.provider] && <span className="ga-bubble ga-bubble-bar" aria-hidden="true">{bubbles[a.provider]}</span>}
                </button>
              );
            })}
            <span className="ga-tray" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M8 3c2.5 0 4.7 1 6.3 2.6l-1.2 1.2A7.2 7.2 0 0 0 8 4.7 7.2 7.2 0 0 0 2.9 6.8L1.7 5.6A8.9 8.9 0 0 1 8 3Zm0 3.4c1.6 0 3 .6 4.1 1.7l-1.2 1.2A4 4 0 0 0 8 8.1a4 4 0 0 0-2.9 1.2L3.9 8.1A5.8 5.8 0 0 1 8 6.4Zm0 3.3c.7 0 1.3.3 1.8.7L8 12.2l-1.8-1.8c.5-.4 1.1-.7 1.8-.7Z" /></svg>
              <svg viewBox="0 0 16 16"><path d="M2 6h2.5L8 3v10L4.5 10H2V6Zm8.2-.9a4 4 0 0 1 0 5.8l-.9-.9a2.8 2.8 0 0 0 0-4l.9-.9Z" /></svg>
              <svg viewBox="0 0 16 16"><path d="M7.3 1.5h1.4V8H7.3V1.5ZM4.3 3.6l1 1a4.3 4.3 0 1 0 5.4 0l1-1a5.7 5.7 0 1 1-7.4 0Z" /></svg>
            </span>
          </span>
        </div>

        {AGENTS.map((a, i) => {
          const agg = aggs.get(a.provider);
          return (
            <button key={a.provider} type="button" ref={(el) => { tileRefs.current[a.provider] = el; }}
              className={`ga-tile ga-tile-${i} is-${agg?.state ?? 'idle'}`}
              aria-label={`${a.name} desktop tile: ${STATE_LABEL[agg?.state ?? 'idle']}. Open preview`}
              onClick={() => openCard(a.provider, 'tile')}>
              <Motion mode={motionFor(agg)} token={agg?.attentionSince} amp={4}><span className="ga-tile-face"><img src={logo(a)} alt="" width="24" height="24" /></span></Motion>
              <i className="dot" />
              {bubbles[a.provider] && <span className="ga-bubble ga-bubble-tile" aria-hidden="true">{bubbles[a.provider]}</span>}
            </button>
          );
        })}

        {winOpen && (
          <section className="ga-win" aria-label="Terminal">
            <header className="ga-win-head">
              <span className="ga-win-title">{tabAgent.project}</span>
              <button type="button" className="ga-win-btn" aria-label="Minimize the terminal" onClick={() => { setWinOpen(false); }}>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 11h8v1.5H4z" /></svg>
              </button>
            </header>
            <div className="ga-tabs" role="tablist" aria-label="Terminal tabs">
              {AGENTS.map((a) => (
                <button key={a.provider} type="button" role="tab" aria-selected={tab === a.provider}
                  className={`ga-tab is-${e.session(a.provider)?.state ?? 'idle'}`} onClick={() => setTab(a.provider)}>
                  <i className="dot" />{a.project}<span className="ga-tab-agent">{a.name}</span>
                </button>
              ))}
            </div>
            <div className="ga-term" role="tabpanel" aria-live="off">
              <p className="ga-line ga-line-info">{tabAgent.name} · ~/code/{tabAgent.project}</p>
              {transcript.map((l) => (
                <p key={l.id} className={`ga-line ga-line-${l.type}`}>
                  {l.type === 'prompt' ? '› ' : l.type === 'tool' ? '● ' : ''}{l.text}
                </p>
              ))}
              {tabSession?.state === State.WAITING && (
                <div className="ga-ask">
                  <p>{tabSession.detail}</p>
                  <button type="button" className="ga-btn ga-btn-primary" onClick={() => e.approve(tab)}>{tabAgent.ask.button}</button>
                </div>
              )}
            </div>
            <form className="ga-prompt" onSubmit={submitPrompt}>
              <label className="visually-hidden" htmlFor="ga-prompt-input">Give {tabAgent.name} a task</label>
              <span aria-hidden="true">›</span>
              <input id="ga-prompt-input" value={prompt} maxLength={120} autoComplete="off"
                placeholder={tabAgent.suggestions[1]} onChange={(ev) => setPrompt(ev.target.value)} />
              <button type="submit" className="ga-btn">Run</button>
            </form>
          </section>
        )}

        {!winOpen && (
          <button type="button" className="ga-btn ga-btn-primary ga-dock" onClick={() => setWinOpen(true)}>Show the terminal</button>
        )}

        {toast && (
          <button type="button" className="ga-toast" onClick={() => { setToast(null); openCard(toast.provider, 'bar'); }}>
            <span className="ga-toast-icon"><img src={logo(agentOf(toast.provider))} alt="" width="20" height="20" /></span>
            <span><b>{toast.title}</b><small>{toast.body}</small></span>
          </button>
        )}

        {card && cardSession && (
          <div className="ga-card" style={{left: card.left, top: card.top}} role="dialog" aria-label={`${cardAgent.name} preview`}>
            {card.notch != null && <span className="ga-notch" style={{left: card.notch - 7}} aria-hidden="true" />}
            <div className="ga-card-head">
              <span className="ga-card-tile"><img src={logo(cardAgent)} alt="" width="22" height="22" /></span>
              <span className="ga-card-title">
                <b>{cardAgent.name}</b>
                <small className={`is-${cardSession.state}`}><i className="dot" />{cardAgent.project} · {formatAgo(now - cardSession.since)}</small>
              </span>
              <span className={`ga-chip is-${cardSession.state}`}>{STATE_LABEL[cardSession.state]}</span>
            </div>
            <p className="ga-card-current">
              {cardSession.state === State.WORKING && cardSession.turnStartedAt
                ? `${cardSession.detail} · ${formatDuration(now - cardSession.turnStartedAt)}`
                : cardSession.detail || 'Ready'}
            </p>
            {cardSession.recent.length > 0 && (
              <div className="ga-log">
                {cardSession.recent.slice(-LOG_LINES).map((r, i) => (
                  <span key={i} className={`ga-log-${r.level}`}>{r.text.startsWith('›') ? r.text : `> ${r.text}`}</span>
                ))}
              </div>
            )}
            <div className="ga-card-actions">
              <button type="button" className="ga-btn ga-btn-primary" onClick={() => openTerminal(card.provider)}>Open in Terminal</button>
              <button type="button" className="ga-btn" onClick={() => dismiss(card.provider)}>Dismiss</button>
            </div>
          </div>
        )}
      </div>

      <div className="ga-controls">
        <div className="ga-tour">
          <p>{tour === 'playing' ? 'The tour plays on its own. Touch anything to take over.' : 'You are in control. Drive each agent below, or click an icon in the top bar.'}</p>
          <button type="button" className="ga-btn" data-tour-toggle onClick={replay}>{tour === 'playing' ? 'Pause the tour' : 'Replay the tour'}</button>
        </div>
        {AGENTS.map((a) => {
          const s = e.session(a.provider);
          const st = s?.state ?? 'idle';
          const busy = st === State.WORKING || st === State.WAITING;
          return (
            <div className="ga-row" key={a.provider}>
              <span className="ga-row-name"><span className="ga-row-logo"><img src={logo(a)} alt="" width="18" height="18" /></span>{a.name}<span className={`ga-chip is-${st}`}>{STATE_LABEL[st]}</span></span>
              <span className="ga-row-actions">
                <button type="button" className="ga-btn" onClick={() => { setTab(a.provider); e.start(a.provider); }}>Start a task</button>
                <button type="button" className="ga-btn" disabled={st !== State.WORKING} onClick={() => e.ask(a.provider)}>{a.provider === 'opencode' ? 'Ask a question' : 'Ask for approval'}</button>
                <button type="button" className="ga-btn" disabled={st !== State.WAITING} onClick={() => e.approve(a.provider)}>{a.ask.button}</button>
                <button type="button" className="ga-btn" disabled={!busy} onClick={() => e.finish(a.provider)}>Finish</button>
                <button type="button" className="ga-btn" disabled={!busy} onClick={() => e.fail(a.provider)}>Throw an error</button>
              </span>
            </div>
          );
        })}
      </div>
      <p className="visually-hidden" aria-live="polite">{announce}</p>
    </div>
  );
}
