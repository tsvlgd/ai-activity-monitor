import React from 'react';
import {AbsoluteFill, spring, useCurrentFrame} from 'remotion';
import {wf} from '../lib/timeline';
import {AgentState, FPS, Provider, TERM, W} from '../theme';
import {Inset} from '../ui/Inset';
import {Notification} from '../ui/Notification';
import {Sfx} from '../ui/Sfx';
import {TopBarStage} from '../ui/Stage';
import {PanelIconSpec} from '../ui/TopBar';

// Word cues (scene local frames).
export const mattersCues = () => ({
	claudeCause: wf('matters', 'approval'),
	claudeAmber: wf('matters', 'amber'),
	opencodeCause: wf('matters', 'asks'),
	opencodeAsk: wf('matters', 'option'),
	codexCause: wf('matters', 'Codex'),
	codexDone: wf('matters', 'done'),
});

type Change = {state: AgentState; at: number; bubble: string; bubbleOut?: number};

// Icon specs for a frame: working until the cue, then the attention state.
export const mattersIcons = (frame: number): PanelIconSpec[] => {
	const c = mattersCues();
	const changes: Record<Provider, Change> = {
		claude: {state: 'waiting', at: c.claudeAmber, bubble: 'need you!', bubbleOut: c.opencodeAsk - 3},
		opencode: {state: 'waiting', at: c.opencodeAsk, bubble: 'need you!', bubbleOut: c.codexDone - 3},
		codex: {state: 'completed', at: c.codexDone, bubble: 'done!'},
	};
	return (['claude', 'opencode', 'codex'] as Provider[]).map((p, i) => {
		const ch = changes[p];
		const on = frame >= ch.at;
		return {
			provider: p,
			state: on ? ch.state : 'working',
			motion: on ? 'attention' : 'work',
			stateAt: on ? ch.at : i * 5,
			bubble: {text: ch.bubble, inAt: ch.at, outAt: ch.bubbleOut},
		};
	});
};

const Banner: React.FC<{frame: number; inAt: number; outAt?: number; provider: Provider; title: string; body: string}> = ({
	frame,
	inAt,
	outAt,
	provider,
	title,
	body,
}) => {
	if (frame < inAt) return null;
	const i = spring({frame: frame - inAt, fps: FPS, config: {damping: 15, stiffness: 150}});
	const o = outAt === undefined ? 0 : spring({frame: frame - outAt, fps: FPS, config: {damping: 20, stiffness: 200}});
	if (o > 0.98) return null;
	return (
		<Notification
			x={W / 2 + 30}
			y={86}
			provider={provider}
			title={title}
			body={body}
			opacity={Math.min(1, i * 1.5) * (1 - o)}
			dy={(1 - i) * -40 - o * 30}
		/>
	);
};

export const Matters: React.FC = () => {
	const frame = useCurrentFrame();
	const c = mattersCues();
	return (
		<AbsoluteFill>
			<TopBarStage z={1} icons={mattersIcons(frame)} scroll={60}>
				<Banner
					frame={frame}
					inAt={c.claudeAmber}
					outAt={c.opencodeAsk - 6}
					provider="claude"
					title="Claude Code needs your approval"
					body="Allow edit to src/auth/session.ts?"
				/>
				<Banner
					frame={frame}
					inAt={c.opencodeAsk}
					outAt={c.codexDone - 6}
					provider="opencode"
					title="OpenCode has a question"
					body="Which database should we use?"
				/>
			</TopBarStage>
			<Inset
				provider="claude"
				state="waiting"
				x={W / 2 - 860}
				at={c.claudeCause}
				frame={frame}
				lines={[
					[{t: '● ', c: TERM.green}, {t: 'Update', b: true}, {t: '(src/auth/session.ts)', c: TERM.dim}],
					[{t: 'Do you want to make this edit?', b: true}],
					[{t: '❯ 1. Yes', c: TERM.cyan}, {t: '   2. No', c: TERM.dim}],
				]}
			/>
			<Inset
				provider="opencode"
				state="waiting"
				x={W / 2 - 270}
				at={c.opencodeCause}
				frame={frame}
				lines={[
					[{t: '? ', c: TERM.yellow, b: true}, {t: 'Which database should we use?', b: true}],
					[{t: '❯ PostgreSQL', c: TERM.cyan}],
					[{t: '  SQLite   MySQL', c: TERM.dim}],
				]}
			/>
			<Inset
				provider="codex"
				state="completed"
				x={W / 2 + 320}
				at={c.codexCause}
				frame={frame}
				lines={[
					[{t: '✓ ', c: TERM.green, b: true}, {t: 'All tests passed', c: TERM.green, b: true}],
					[{t: '42 passed', c: TERM.fg}, {t: ' · 3.1s', c: TERM.dim}],
					[{t: 'Task complete.', c: TERM.dim}],
				]}
			/>
			<Sfx name="ding" at={c.claudeAmber} volume={0.3} />
			<Sfx name="ding" at={c.opencodeAsk} volume={0.3} />
			<Sfx name="bump" at={c.codexDone} volume={0.3} />
			<Sfx name="ding" at={c.codexDone + 2} volume={0.22} />
			<Sfx name="pop" at={c.claudeCause} volume={0.18} />
			<Sfx name="pop" at={c.opencodeCause} volume={0.18} />
			<Sfx name="pop" at={c.codexCause} volume={0.18} />
		</AbsoluteFill>
	);
};
