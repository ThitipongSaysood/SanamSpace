/**
 * The court behind the venue's login screen.
 *
 * A venue that has not uploaded a photo still gets a background of its OWN
 * sport rather than a flat panel — the markings of a badminton court for a
 * badminton venue, a pitch for a football one, drawn in the venue's colour.
 *
 * It is line art rather than a photograph on purpose: a stock photo of someone
 * else's hall is a claim about a place the customer is about to walk into, and
 * it would also be the same photo for every venue on the platform. Lines are
 * honest about being a backdrop, they weigh nothing, and they take the venue's
 * colour — which a photo cannot.
 *
 * Every sport is described in COURT SPACE — u across the court (0..1), v from
 * the far end (0) to the near end (1) — and `project` puts that plane into
 * perspective once, for all of them. Adding a sport is a list of lines, never
 * a second set of geometry.
 */

/** The catalogue's two aliases, so a branch storing either still draws a court. */
const ALIASES: Record<string, string> = { soccer: "football", pingpong: "tabletennis" };

type Line = [number, number][];

/**
 * Where the court plane sits on screen, as a share of the viewBox.
 *
 * `EASE` is what makes it read as depth: the far half of the court occupies the
 * top sliver, the near half most of the height, the way a court does when you
 * stand at one end of it.
 */
const FAR_HALF_WIDTH = 0.22;
// Just past the edge of the screen: a court whose sidelines leave the frame
// early stops reading as a court and becomes two diagonal lines.
const NEAR_HALF_WIDTH = 0.78;
const FAR_Y = 0.08;
const NEAR_Y = 1;
const EASE = 1.25;

const W = 400;
const H = 260;

function project(u: number, v: number): [number, number] {
  const t = Math.pow(v, EASE);
  const y = FAR_Y + (NEAR_Y - FAR_Y) * t;
  const halfWidth = FAR_HALF_WIDTH + (NEAR_HALF_WIDTH - FAR_HALF_WIDTH) * t;

  return [(0.5 + (u - 0.5) * 2 * halfWidth) * W, y * H];
}

const path = (line: Line) => line.map(([u, v]) => project(u, v).join(",")).join(" ");

/** A closed shape in court space — the outline, a box, the middle of a pitch. */
function box(u1: number, v1: number, u2: number, v2: number): Line {
  return [
    [u1, v1],
    [u2, v1],
    [u2, v2],
    [u1, v2],
    [u1, v1],
  ];
}

/**
 * A circle on the court floor.
 *
 * Drawn as a polyline through court space rather than as an <ellipse>, so
 * perspective foreshortens it the same way it foreshortens everything else —
 * an ellipse would keep the same shape wherever it sat.
 */
function circle(cu: number, cv: number, ru: number, rv: number, steps = 40): Line {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = (i / steps) * Math.PI * 2;

    return [cu + Math.cos(a) * ru, cv + Math.sin(a) * rv] as [number, number];
  });
}

const OUTLINE = box(0, 0, 1, 1);

/**
 * The markings of each sport, and where its net stands (v, or null for none).
 *
 * Sports that share a court share an entry: pickleball is played on lines a
 * tennis player recognises, takraw on a volleyball court.
 */
const COURTS: Record<string, { lines: Line[]; net: number | null }> = {
  badminton: {
    net: 0.5,
    lines: [
      OUTLINE,
      box(0.08, 0, 0.92, 1), // singles sidelines
      [
        [0, 0.28],
        [1, 0.28],
      ],
      [
        [0, 0.72],
        [1, 0.72],
      ],
      [
        [0, 0.06],
        [1, 0.06],
      ], // long service line, doubles
      [
        [0, 0.94],
        [1, 0.94],
      ],
      [
        [0.5, 0],
        [0.5, 0.28],
      ], // centre line, each service court
      [
        [0.5, 0.72],
        [0.5, 1],
      ],
    ],
  },
  tennis: {
    net: 0.5,
    lines: [
      OUTLINE,
      box(0.11, 0, 0.89, 1), // singles court
      [
        [0.11, 0.3],
        [0.89, 0.3],
      ],
      [
        [0.11, 0.7],
        [0.89, 0.7],
      ],
      [
        [0.5, 0.3],
        [0.5, 0.7],
      ], // centre service line
    ],
  },
  football: {
    net: null,
    lines: [
      OUTLINE,
      [
        [0, 0.5],
        [1, 0.5],
      ],
      circle(0.5, 0.5, 0.14, 0.1),
      box(0.24, 0, 0.76, 0.16), // penalty areas
      box(0.24, 0.84, 0.76, 1),
      box(0.38, 0, 0.62, 0.06), // goal areas
      box(0.38, 0.94, 0.62, 1),
    ],
  },
  basketball: {
    net: null,
    lines: [
      OUTLINE,
      [
        [0, 0.5],
        [1, 0.5],
      ],
      circle(0.5, 0.5, 0.12, 0.085),
      box(0.35, 0, 0.65, 0.19), // the key, each end
      box(0.35, 0.81, 0.65, 1),
      circle(0.5, 0.19, 0.12, 0.085),
      circle(0.5, 0.81, 0.12, 0.085),
    ],
  },
  volleyball: {
    net: 0.5,
    lines: [
      OUTLINE,
      [
        [0, 0.33],
        [1, 0.33],
      ], // attack lines
      [
        [0, 0.67],
        [1, 0.67],
      ],
    ],
  },
  tabletennis: {
    net: 0.5,
    lines: [
      OUTLINE,
      [
        [0.5, 0],
        [0.5, 1],
      ], // the centre line down the table
    ],
  },
  squash: {
    net: null,
    lines: [
      OUTLINE,
      [
        [0, 0.55],
        [1, 0.55],
      ], // short line
      [
        [0.5, 0.55],
        [0.5, 1],
      ], // half court line
      box(0, 0.55, 0.26, 0.81), // service boxes
      box(0.74, 0.55, 1, 0.81),
    ],
  },
};

/** Sports the catalogue names that are played on a court above. */
const SHARES: Record<string, string> = {
  futsal: "football",
  pickleball: "tennis",
  takraw: "volleyball",
};

function courtFor(sport: string | null | undefined) {
  const key = sport ? (ALIASES[sport] ?? sport) : "";

  return COURTS[SHARES[key] ?? key] ?? COURTS.football;
}

/**
 * @param sport  The venue's primary sport key. Unknown or missing draws a pitch,
 *               which is the most court-like thing to show when we do not know.
 * @param color  The venue's primary colour — the floor is tinted with it.
 */
export function CourtBackdrop({
  sport,
  color,
  className = "",
}: {
  sport?: string | null;
  color: string;
  className?: string;
}) {
  const { lines, net } = courtFor(sport);
  // The net is a vertical surface, so it is the only thing NOT on the floor
  // plane: its foot is the court line, and it stands up from there in screen
  // space. Height comes from the court's own perspective — a net at the far end
  // would be shorter — so it never looks pasted on.
  const netFoot = net === null ? null : project(0, net);
  const netEnd = net === null ? null : project(1, net);
  const netHeight = netFoot ? Math.max(6, (netFoot[1] / H) * 26) : 0;

  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${className}`} aria-hidden="true">
      {/* Stretched to the box rather than fitted to it: `slice` would scale the
          drawing up to cover a tall container and crop the sidelines off — the
          one part of a court that has to stay on screen for it to read as one.
          A perspective drawing survives being stretched; it just gets deeper. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="none">
        <defs>
          {/* Floor: the venue's colour, deepening towards the viewer. Kept far
              off full strength — this sits behind a sign-in button that has to
              stay the most prominent thing on the screen. */}
          <linearGradient id="cb-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.1" />
            <stop offset="55%" stopColor={color} stopOpacity="0.42" />
            <stop offset="100%" stopColor={color} stopOpacity="0.72" />
          </linearGradient>
          {/* Fades the whole drawing out towards the top, so it meets the page
              background instead of ending on a hard edge. */}
          <linearGradient id="cb-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="34%" stopColor="white" stopOpacity="0.55" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id="cb-mask">
            <rect width={W} height={H} fill="url(#cb-fade)" />
          </mask>
        </defs>

        <g mask="url(#cb-mask)">
          <polygon points={path(OUTLINE)} fill="url(#cb-floor)" />

          <g fill="none" stroke="white" strokeOpacity="0.75" strokeWidth="1.1" strokeLinejoin="round">
            {lines.map((line, i) => (
              <polyline key={i} points={path(line)} />
            ))}
          </g>

          {netFoot && netEnd && (
            <polygon
              points={[
                `${netFoot[0]},${netFoot[1]}`,
                `${netEnd[0]},${netEnd[1]}`,
                `${netEnd[0]},${netEnd[1] - netHeight}`,
                `${netFoot[0]},${netFoot[1] - netHeight}`,
              ].join(" ")}
              fill="white"
              fillOpacity="0.22"
              stroke="white"
              strokeOpacity="0.5"
              strokeWidth="1.2"
            />
          )}
        </g>
      </svg>
    </div>
  );
}
