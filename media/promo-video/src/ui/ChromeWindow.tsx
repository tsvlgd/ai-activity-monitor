import React from 'react';
import {FONT_MONO, FONT_UI} from '../theme';
import {Frame, TrafficLights, WindowShell} from './Window';

const ink = '#1f2329';
const muted = '#5f6672';

const NavIcon: React.FC<{d: string}> = ({d}) => (
	<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d={d} />
	</svg>
);


export type Tab = {title: string; color: string};
export const DOCS_TAB: Tab = {title: 'Getting started · Docs', color: '#5b7bd5'};
export const DOCS_URL: [string, string] = ['docs.example.dev', '/guide/getting-started'];

// Generic documentation page (page area coordinates).
export const DocsPage: React.FC<{scroll?: number}> = ({scroll = 0}) => (
	<div style={{position: 'absolute', inset: 0, background: '#ffffff', fontFamily: FONT_UI}}>
			<div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: 260, background: '#f7f8fa', borderRight: '1px solid #eceef2', padding: '28px 26px'}}>
				<div style={{fontWeight: 700, fontSize: 15, color: ink, marginBottom: 16}}>Guide</div>
				{['Introduction', 'Getting started', 'Configuration', 'Authentication', 'Sessions', 'Testing', 'Deployment', 'FAQ'].map((t, i) => (
					<div
						key={t}
						style={{
							fontSize: 14.5,
							color: i === 1 ? '#2f55c4' : muted,
							fontWeight: i === 1 ? 600 : 400,
							padding: '7px 10px',
							borderRadius: 8,
							background: i === 1 ? 'rgba(47,85,196,0.08)' : 'transparent',
							marginBottom: 2,
						}}
					>
						{t}
					</div>
				))}
			</div>
			<div style={{position: 'absolute', left: 320, top: 36 - scroll, right: 80, color: ink}}>
				<div style={{fontSize: 14, color: muted, marginBottom: 10}}>Guide / Getting started</div>
				<div style={{fontSize: 40, fontWeight: 700, letterSpacing: -0.5, marginBottom: 18}}>Getting started</div>
				<div style={{fontSize: 18, lineHeight: 1.65, color: '#3a404b', maxWidth: 820, marginBottom: 22}}>
					Install the package, create a configuration file and start the development server. The service reads its
					settings from the environment and refreshes sessions automatically.
				</div>
				<div
					style={{
						background: '#f4f6f9',
						border: '1px solid #e6e9ee',
						borderRadius: 10,
						padding: '16px 20px',
						fontFamily: FONT_MONO,
						fontSize: 15.5,
						lineHeight: 1.7,
						color: '#2b303b',
						maxWidth: 780,
						marginBottom: 26,
					}}
				>
					<div>$ npm install</div>
					<div>$ cp .env.example .env</div>
					<div>$ npm run dev</div>
				</div>
				<div style={{fontSize: 26, fontWeight: 700, marginBottom: 12}}>Session tokens</div>
				<div style={{fontSize: 18, lineHeight: 1.65, color: '#3a404b', maxWidth: 820, marginBottom: 18}}>
					Tokens are signed with a rotating key. Refresh tokens live for seven days and are bound to the client that
					requested them. Revoked tokens are rejected on the next request.
				</div>
				<div style={{fontSize: 26, fontWeight: 700, marginBottom: 12}}>Running the tests</div>
				<div style={{fontSize: 18, lineHeight: 1.65, color: '#3a404b', maxWidth: 820}}>
					The test suite uses an in memory store, so it runs without a database. Run it before every commit.
				</div>
			</div>
	</div>
);

// A light browser window. Tabs, URL and page content are pluggable; the default
// is a single tab with the generic documentation page.
export const ChromeWindow: React.FC<{
	frame: Frame;
	scroll?: number;
	style?: React.CSSProperties;
	radius?: number;
	tabs?: Tab[];
	active?: number;
	url?: [string, string];
	children?: React.ReactNode;
}> = ({frame, scroll = 0, style, radius, tabs = [DOCS_TAB], active = 0, url = DOCS_URL, children}) => (
	<WindowShell frame={frame} style={{...style, ...(radius !== undefined ? {borderRadius: radius} : {})}}>
		<div style={{position: 'absolute', inset: 0, background: '#ffffff'}} />
		{/* Tab strip */}
		<div style={{position: 'absolute', left: 0, right: 0, top: 0, height: 44, background: '#dfe3ea'}}>
			<div style={{position: 'absolute', left: 18, top: 16}}>
				<TrafficLights size={12} />
			</div>
			{tabs.map((t, i) => (
				<div
					key={t.title}
					style={{
						position: 'absolute',
						left: 96 + i * 300,
						top: 8,
						width: 296,
						height: 36,
						background: i === active ? '#ffffff' : 'transparent',
						borderRadius: '10px 10px 0 0',
						display: 'flex',
						alignItems: 'center',
						gap: 9,
						padding: '0 14px',
						boxSizing: 'border-box',
						fontFamily: FONT_UI,
						fontSize: 13.5,
						color: i === active ? ink : '#5f6672',
					}}
				>
					<div style={{width: 16, height: 16, borderRadius: 4, background: t.color, flexShrink: 0}} />
					<span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{t.title}</span>
					<span style={{color: '#80868b', fontSize: 15}}>×</span>
				</div>
			))}
			<div style={{position: 'absolute', left: 96 + tabs.length * 300 + 12, top: 12, fontFamily: FONT_UI, fontSize: 20, color: '#5f6368'}}>+</div>
		</div>
		{/* Toolbar */}
		<div
			style={{
				position: 'absolute',
				left: 0,
				right: 0,
				top: 44,
				height: 46,
				background: '#ffffff',
				borderBottom: '1px solid #e3e6eb',
				display: 'flex',
				alignItems: 'center',
				gap: 14,
				padding: '0 16px',
			}}
		>
			<NavIcon d="M15 18l-6-6 6-6" />
			<NavIcon d="M9 18l6-6-6-6" />
			<NavIcon d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
			<div
				style={{
					flex: 1,
					height: 32,
					borderRadius: 16,
					background: '#f1f3f6',
					display: 'flex',
					alignItems: 'center',
					padding: '0 16px',
					gap: 10,
					fontFamily: FONT_UI,
					fontSize: 14.5,
					color: '#3c4043',
				}}
			>
				<svg width="13" height="13" viewBox="0 0 24 24" fill="#5f6368">
					<path d="M6 10V8a6 6 0 1 1 12 0v2h1v12H5V10zm2 0h8V8a4 4 0 1 0-8 0z" />
				</svg>
				<span>
					{url[0]}<span style={{color: '#80868b'}}>{url[1]}</span>
				</span>
			</div>
			<div style={{width: 26, height: 26, borderRadius: 13, background: '#c9d3e6'}} />
		</div>
		{/* Page */}
		<div style={{position: 'absolute', left: 0, right: 0, top: 90, bottom: 0, overflow: 'hidden', fontFamily: FONT_UI}}>
			{children ?? <DocsPage scroll={scroll} />}
		</div>
	</WindowShell>
);
