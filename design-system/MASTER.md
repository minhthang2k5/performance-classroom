# Performance Lab — UI decisions

Based on UI/UX Pro Max search `analytics dashboard university professional` (Data-Dense Dashboard), plus the React stack guidance and accessibility checklist.

- Audience: university students learning performance testing through recorded data.
- Use a light, clear dashboard rather than the search result's enterprise sales landing pattern. Learning objectives take priority over conversion CTAs.
- Primary #1E40AF; secondary blue #3B82F6; amber #D97706; background #F8FAFC; cards white; text navy/slate. Keep semantic colors in CSS variables.
- Sans-serif body and headings; monospaced/tabular numbers for metrics. System fonts provide Vietnamese support and offline operation; Fira Sans/Fira Code remain optional rather than network dependencies.
- Persistent course sidebar, clear lesson progress, readable charts, large labels, one main action per screen. 44px interaction targets; visible focus; native radios grouped by fieldset/legend.
- Distinguish actual historical metrics from illustrative playback. Phase bars are aggregates, never continuous latency telemetry. Full data tables provide the accessible equivalent.
- Respect reduced motion, 375px/768px/1024px/1440px widths, deep links and browser back. Status/error messages use appropriate live regions, without announcing the timer every second.
- SVG outline icons, no emoji, no external image or font dependency. Restrained rounded panels, subtle borders, generous grouping for classroom projection.
- Admin: results, completion-order ranking, reset only. Destructive reset uses a keyboard-accessible dialog with explicit consequences and cancel.

The skill's persistence script could not create a hard link on this Windows filesystem; these verified decisions are saved as a normal Markdown file instead.
