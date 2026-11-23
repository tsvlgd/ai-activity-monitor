import React from 'react';
import {FONT_UI} from '../theme';
import {Tab} from './ChromeWindow';

// Generic pages for the browser (page area coordinates, no real brands).

export const VIDEO_TAB: Tab = {title: 'Designing calm interfaces, conference talk', color: '#7c5cff'};
export const VIDEO_URL: [string, string] = ['video.example.net', '/watch/calm-interfaces'];
export const BLOG_TAB: Tab = {title: 'A gentle guide to Wayland', color: '#2fa58a'};
export const BLOG_URL: [string, string] = ['blog.example.dev', '/a-gentle-guide-to-wayland'];

const ink = '#1f2329';
const muted = '#5f6672';

// Player geometry (theater layout). Exported so scenes can scroll it into view.
export const PLAYER = {x: 320, y: 20, w: 1160, h: 652};
const LENGTH = 252; // 4:12
const START = 112; // starts playing at 1:52

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Abstract, calm "talk" visual: drifting soft shapes over a slowly shifting gradient.
const Visual: React.FC<{t: number}> = ({t}) => {
	const hue = 250 + 25 * Math.sin(t / 5);
	const blobs = [
		{r: 260, x: 0.25 + 0.12 * Math.sin(t * 0.7), y: 0.35 + 0.15 * Math.cos(t * 0.5), c: 'rgba(124, 92, 255, 0.55)'},
		{r: 320, x: 0.72 + 0.1 * Math.cos(t * 0.6), y: 0.55 + 0.18 * Math.sin(t * 0.45), c: 'rgba(47, 165, 138, 0.45)'},
		{r: 200, x: 0.5 + 0.2 * Math.sin(t * 0.9 + 1), y: 0.8 + 0.1 * Math.cos(t * 0.8), c: 'rgba(255, 170, 120, 0.45)'},
		{r: 150, x: 0.85 + 0.08 * Math.sin(t * 1.1), y: 0.2 + 0.1 * Math.cos(t * 1.3), c: 'rgba(100, 210, 255, 0.5)'},
	];
	return (
		<div
			style={{
				position: 'absolute',
				inset: 0,
				overflow: 'hidden',
				background: `linear-gradient(${135 + 20 * Math.sin(t / 3)}deg, hsl(${hue}, 45%, 18%) 0%, hsl(${hue + 40}, 50%, 26%) 100%)`,
			}}
		>
			{blobs.map((b, i) => (
				<div
					key={i}
					style={{
						position: 'absolute',
						left: `${b.x * 100}%`,
						top: `${b.y * 100}%`,
						width: b.r * 2,
						height: b.r * 2,
						marginLeft: -b.r,
						marginTop: -b.r,
						borderRadius: '50%',
						background: `radial-gradient(circle, ${b.c} 0%, rgba(0,0,0,0) 70%)`,
					}}
				/>
			))}
			{/* Slide on stage */}
			<div
				style={{
					position: 'absolute',
					left: '50%',
					top: '42%',
					transform: `translate(-50%, -50%) translateY(${4 * Math.sin(t * 0.8)}px)`,
					textAlign: 'center',
					color: 'rgba(255,255,255,0.92)',
					fontFamily: FONT_UI,
				}}
			>
				<div style={{fontSize: 22, letterSpacing: 4, opacity: 0.7, fontWeight: 600}}>PART TWO</div>
				<div style={{fontSize: 64, fontWeight: 700, letterSpacing: -1}}>Calm by default</div>
				<div style={{margin: '18px auto 0', width: 120 + 40 * Math.sin(t * 1.2), height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.6)'}} />
			</div>
		</div>
	);
};

const Icon: React.FC<{d: string; fill?: boolean}> = ({d, fill}) => (
	<svg width="26" height="26" viewBox="0 0 24 24" fill={fill ? '#ffffff' : 'none'} stroke="#ffffff" strokeWidth={fill ? 0 : 2} strokeLinecap="round" strokeLinejoin="round">
		<path d={d} />
	</svg>
);

export const VideoPage: React.FC<{t: number; playing?: boolean; scroll?: number}> = ({t, playing = true, scroll = 0}) => {
	const pos = Math.min(LENGTH, START + t);
	const frac = pos / LENGTH;
	return (
		<div style={{position: 'absolute', inset: 0, background: '#ffffff', fontFamily: FONT_UI}}>
			<div style={{position: 'absolute', left: 0, right: 0, top: -scroll}}>
				<div style={{position: 'absolute', left: PLAYER.x, top: PLAYER.y, width: PLAYER.w, height: PLAYER.h, borderRadius: 14, overflow: 'hidden', background: '#000'}}>
					<Visual t={t} />
					<div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: 120, background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)'}} />
					{/* Progress */}
					<div style={{position: 'absolute', left: 20, right: 20, bottom: 50, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.3)'}}>
						<div style={{position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, borderRadius: 3, background: '#a48bff'}} />
						<div style={{position: 'absolute', left: `${frac * 100}%`, top: -5, width: 15, height: 15, marginLeft: -7, borderRadius: 8, background: '#ffffff'}} />
					</div>
					{/* Controls */}
					<div style={{position: 'absolute', left: 20, right: 20, bottom: 12, height: 30, display: 'flex', alignItems: 'center', gap: 18, color: '#fff', fontSize: 17, fontWeight: 600}}>
						{playing ? <Icon d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill /> : <Icon d="M7 4.5v15l12.5-7.5z" fill />}
						<Icon d="M6 5v14M10 5l9 7-9 7z" fill />
						<Icon d="M4 9h3.5L12 5v14l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6" />
						<div style={{width: 90, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.45)'}}>
							<div style={{width: 62, height: 4, borderRadius: 2, background: '#fff'}} />
						</div>
						<div style={{flex: 1}} />
						<span>
							{fmt(pos)} / {fmt(LENGTH)}
						</span>
						<Icon d="M4 6h16v12H4zM8 11h3M13 11h3M8 14h8" />
						<Icon d="M12 8.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM12 2v3M12 19v3M2 12h3M19 12h3" />
						<Icon d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
					</div>
				</div>
				{/* Title and channel */}
				<div style={{position: 'absolute', left: PLAYER.x, top: PLAYER.y + PLAYER.h + 22, width: PLAYER.w}}>
					<div style={{fontSize: 30, fontWeight: 700, color: ink, letterSpacing: -0.3}}>Designing calm interfaces, conference talk</div>
					<div style={{display: 'flex', alignItems: 'center', gap: 14, marginTop: 16}}>
						<div style={{width: 46, height: 46, borderRadius: 23, background: 'linear-gradient(135deg, #a48bff, #2fa58a)'}} />
						<div>
							<div style={{fontSize: 18, fontWeight: 700, color: ink}}>Interface Weekly</div>
							<div style={{fontSize: 15, color: muted}}>48K subscribers</div>
						</div>
						<div style={{marginLeft: 18, padding: '10px 20px', borderRadius: 20, background: '#1f2329', color: '#fff', fontSize: 15, fontWeight: 700}}>Subscribe</div>
						<div style={{flex: 1}} />
						<div style={{padding: '10px 20px', borderRadius: 20, background: '#f0f2f5', color: ink, fontSize: 15, fontWeight: 600}}>12K likes</div>
						<div style={{padding: '10px 20px', borderRadius: 20, background: '#f0f2f5', color: ink, fontSize: 15, fontWeight: 600}}>Share</div>
					</div>
				</div>
				{/* Up next */}
				<div style={{position: 'absolute', left: PLAYER.x + PLAYER.w + 40, top: PLAYER.y, width: 360}}>
					<div style={{fontSize: 17, fontWeight: 700, color: ink, marginBottom: 14}}>Up next</div>
					{[
						['Type scales that breathe', '#ffb48a', '#7c5cff'],
						['Motion with restraint', '#2fa58a', '#64d2ff'],
						['Colour for long sessions', '#a48bff', '#ffd27a'],
						['Quiet notifications', '#64d2ff', '#2fa58a'],
					].map(([title, a, b]) => (
						<div key={title} style={{display: 'flex', gap: 12, marginBottom: 16}}>
							<div style={{width: 150, height: 84, borderRadius: 10, background: `linear-gradient(135deg, ${a}, ${b})`, flexShrink: 0}} />
							<div>
								<div style={{fontSize: 15, fontWeight: 600, color: ink, lineHeight: 1.3}}>{title}</div>
								<div style={{fontSize: 13, color: muted, marginTop: 4}}>Interface Weekly</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
};

export const BlogPage: React.FC<{scroll?: number}> = ({scroll = 0}) => {
	const p = (text: string) => (
		<p style={{fontSize: 21, lineHeight: 1.75, color: '#353b46', margin: '0 0 22px'}}>{text}</p>
	);
	return (
		<div style={{position: 'absolute', inset: 0, background: '#fbfbf9', fontFamily: FONT_UI}}>
			<div style={{position: 'absolute', left: 0, right: 0, top: -scroll}}>
				<div style={{width: 780, margin: '0 auto', paddingTop: 56}}>
					<div style={{fontSize: 15, fontWeight: 700, color: '#2fa58a', letterSpacing: 1.5}}>LINUX DESKTOP</div>
					<div style={{fontSize: 52, fontWeight: 700, color: ink, letterSpacing: -1, lineHeight: 1.15, margin: '12px 0 18px'}}>A gentle guide to Wayland</div>
					<div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32}}>
						<div style={{width: 40, height: 40, borderRadius: 20, background: 'linear-gradient(135deg, #2fa58a, #64d2ff)'}} />
						<div style={{fontSize: 16, color: muted}}>
							<b style={{color: ink}}>Sam Rivera</b> · 6 min read
						</div>
					</div>
					<div style={{height: 300, borderRadius: 16, marginBottom: 32, background: 'linear-gradient(135deg, #dff3ec 0%, #e5ecff 100%)', position: 'relative', overflow: 'hidden'}}>
						<div style={{position: 'absolute', left: 90, top: 70, width: 260, height: 170, borderRadius: 12, background: '#ffffff', boxShadow: '0 10px 30px rgba(20,26,38,0.12)'}} />
						<div style={{position: 'absolute', left: 300, top: 110, width: 260, height: 150, borderRadius: 12, background: '#ffffff', boxShadow: '0 10px 30px rgba(20,26,38,0.16)'}} />
						<div style={{position: 'absolute', left: 520, top: 60, width: 160, height: 160, borderRadius: 80, background: 'rgba(47,165,138,0.25)'}} />
					</div>
					{p('Wayland is the display protocol most Linux desktops now use by default. Instead of one server drawing everything, each app hands finished frames to the compositor, which decides what goes on screen.')}
					{p('That makes the desktop smoother and safer: apps cannot read each other’s windows or inject input. It also changes how screenshots, screen sharing and global shortcuts work.')}
					{p('The good news is that most of this is invisible day to day. Your browser, your terminal and your editor all speak Wayland natively.')}
				</div>
			</div>
		</div>
	);
};
