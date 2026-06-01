# DESIGN_SYSTEM.md

# ApexGP Markets

## Design System

---

# Design Philosophy

ApexGP Markets should feel like:

Institutional Market Broadcast

Composition:

45% Bloomberg Terminal

35% Formula One Broadcast

20% Quant Research Lab

The experience should feel:

premium

controlled

alive

institutional

dense

The experience should NOT feel like:

sports betting

crypto dashboard

gaming UI

startup landing page

Apple clone

---

# Experience Model

Emotional trajectory:

```text
Landing

↓

Movie

↓

Terminal Launch

↓

Trading Day

↓

Settlement

↓

Reflection
```

Users should feel:

curiosity

control

exposure

uncertainty

ownership

---

# Visual Identity

Architecture:

Terminal-on-Glass

Rules:

```text
Background
cinematic

Panels
glass

Data
sharp

Charts
flat

Motion
functional
```

Never:

glass everywhere.

---

# Color Philosophy

Market State Colors

Base:

deep graphite

near monochrome

Color appears through system state.

No section owns color.

---

# Color Roles

Market

Electric Blue

---

Replay

Muted Race Red

---

Portfolio Gain

Muted Green

---

Portfolio Loss

Muted Red

---

Research

Platinum

---

Settlement

Soft Gold

---

Background

Deep Carbon

---

Surface

Graphite

---

Elevated Surface

Dark Glass

---

Text Primary

White

---

Text Secondary

Slate

---

# Density System

Adaptive Density

Rules:

Landing

minimal

Workspace

dense

Portfolio

high density

Research

medium

Avoid:

large empty whitespace.

Avoid:

Bloomberg overload.

---

# Environment System

Context-aware environments.

Landing

cinematic

---

Market

terminal

---

Replay

subtle race atmosphere

---

Portfolio

research workspace

---

Research

clean institutional

Backgrounds should never compete with content.

---

# Typography

Functional Typography

Display

premium

large

high authority

---

Body

neutral

high readability

---

Data

monospace

terminal style

Example:

```text
Display

Söhne

Body

Inter

Data

JetBrains Mono
```

Rules:

Numbers always use data font.

---

# Navigation

Market Workspace

Layout:

```text
TOP
Primary Tabs

LEFT
Context

CENTER
Workspace

RIGHT
Portfolio

BOTTOM
Commentary
```

Pages should not reload.

Workspace changes.

Shell remains.

---

# Motion System

State-driven motion.

Motion exists only when information changes.

Allowed:

price movement

contract update

portfolio update

terminal transition

market halt

settlement

commentary arrival

Forbidden:

parallax

camera motion

particles

continuous loops

decorative movement

Timing:

150–400ms

---

# Landing Experience

Visual Signature #1

Collapsing Terminal

Flow:

```text
Fullscreen

↓

Market Thesis

↓

ENTER MARKET

↓

Terminal Expands
```

Landing is emotional.

Everything after is operational.

---

# Terminal Experience

Visual Signature #2

Market Commentary Rail

Always visible.

Purpose:

explain price movement.

Example:

```text
LAP 41

Winner Market

0.71 → 0.82

Drivers:

Track Position

Sector Pace
```

Commentary should feel:

Bloomberg headline

NOT

sports commentary

---

# Glass Rules

Variable Glass

Landing

strong

---

Workspace

light

---

Research

minimal

Rules:

Glass supports hierarchy.

Never decorative.

---

# Charts

Mixed Chart System

Portfolio

Bloomberg

---

Replay

F1 telemetry

---

Research

quant

Allowed:

equity curves

heatmaps

small multiples

probability curves

Forbidden:

pie charts

donuts

rainbow palettes

3D charts

---

# Components

Cards

soft

layered

compact

---

Buttons

solid

terminal-like

---

Tables

dense

---

Contracts

market cards

---

Portfolio

panel based

---

# Borders

Minimal.

Use separation through:

depth

contrast

glass

not lines.

---

# Icons

Minimal.

Outline only.

No racing illustrations.

No finance clichés.

---

# Sound

Disabled.

No:

ticks

alerts

settlement sounds

Experience should remain silent.

---

# Device Priority

Desktop-first.

Desktop:

full experience

Tablet:

usable

Mobile:

graceful fallback

Mobile parity not required.

---

# Performance Rules

Fast.

No unnecessary animation.

No heavy backgrounds.

Target:

feels immediate.

---

# Final Visual Test

Ask:

Would this feel believable if shown on:

Bloomberg

Citadel

Jane Street

Polymarket Research

If yes:

approve.

If user says:

“This feels like a sportsbook.”

reject.

---

END DESIGN SYSTEM
