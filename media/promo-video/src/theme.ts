import {loadFont as loadUbuntuSans} from '@remotion/google-fonts/UbuntuSans';
import {loadFont as loadJetBrains} from '@remotion/google-fonts/JetBrainsMono';

const ui = loadUbuntuSans('normal', {weights: ['400', '500', '600', '700', '800'], subsets: ['latin']});
const mono = loadJetBrains('normal', {weights: ['400', '700'], subsets: ['latin']});

export const FONT_UI = `${ui.fontFamily}, Inter, system-ui, sans-serif`;
export const FONT_MONO = `${mono.fontFamily}, monospace`;

export const W = 1920;
export const H = 1080;
export const FPS = 30;
export const TOPBAR_H = 34;

export type AgentState = 'idle' | 'working' | 'waiting' | 'completed' | 'error';
export type Provider = 'claude' | 'opencode' | 'codex';

// State colours from the extension stylesheet.
export const STATE: Record<AgentState, string> = {
	idle: '#a3acb9',
	working: '#3fa877',
	waiting: '#df9a3c',
	completed: '#6688cc',
	error: '#cf5f58',
};

// .aimon-chip-* text and background colours.
export const CHIP: Record<AgentState, {fg: string; bg: string}> = {
	idle: {fg: '#4b5563', bg: 'rgba(120, 130, 145, 0.14)'},
	working: {fg: '#2f7d58', bg: 'rgba(63, 168, 119, 0.15)'},
	waiting: {fg: '#9a6418', bg: 'rgba(223, 154, 60, 0.18)'},
	completed: {fg: '#3d5f9e', bg: 'rgba(102, 136, 204, 0.16)'},
	error: {fg: '#a8423c', bg: 'rgba(207, 95, 88, 0.16)'},
};

export const STATE_LABEL: Record<AgentState, string> = {
	idle: 'Idle',
	working: 'Working',
	waiting: 'Needs you',
	completed: 'Done',
	error: 'Error',
};

export const NAME: Record<Provider, string> = {
	claude: 'Claude Code',
	opencode: 'OpenCode',
	codex: 'Codex',
};

// gnome-terminal profile of the user.
export const TERM = {
	bg: '#1C1F24',
	fg: '#FFFFFF',
	dim: '#8b93a1',
	red: '#FF453A',
	green: '#34C759',
	yellow: '#FFD60A',
	blue: '#0A84FF',
	magenta: '#BF5AF2',
	cyan: '#64D2FF',
	orange: '#D97757',
};

export const CHARCOAL = '#2b303b';
