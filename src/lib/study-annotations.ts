import type { Annotation, Kind, Rect } from "./annotations";
import anchors from "./study-annotation-anchors.json";

// Curated reading examples, anchored to physical pages of the bundled PDFs.
// Highlights intentionally have no commentary; notes and questions are examples
// of a reader's own response, rather than claims made by the paper's authors.
const rows: Record<string, [Kind, number, string, string][]> = {
  "ceres-brittle-boulders": [
    [
      "highlight",
      1,
      "We mapped all boulders larger than 105 m on the surface of dwarf planet Ceres",
      "",
    ],
    [
      "note",
      8,
      "Age must affect the number of boulders, as they are destroyed over time.",
      "A crater's boulder count records both formation and survival. Comparing two craters without accounting for their ages could hide the difference we are trying to measure.",
    ],
    [
      "question",
      14,
      "boulders live shorter on Ceres than on Vesta",
      "What evidence separates the effect of ice inside the boulders from differences in composition, impacts, or thermal weathering?",
    ],
  ],
  "sedna-trajectories": [
    ["highlight", 1, "Since Sedna will reach its perihelion in 2076", ""],
    [
      "note",
      6,
      "Shorter mission durations typically involve smaller Jupiter flyby distances, resulting in higher radiation doses to the spacecraft.",
      "The fastest trajectory is not automatically the most useful one. A close Jupiter pass can save travel time while demanding more radiation protection.",
    ],
    [
      "question",
      9,
      "This mass is what can be used for any sort of lander, or mission tool to be used in the mission.",
      "How much of the delivered mass remains for science instruments after power, thermal control, communications, and landing hardware?",
    ],
  ],
  "arxiv-2501.05337": [
    [
      "highlight",
      1,
      "using ground-based measurements of surface pressure by the Perseverance rover in combination with orbital images",
      "",
    ],
    [
      "note",
      8,
      "The dominant period is between 2 and 4 sols",
      "These multi-day pressure variations are a different rhythm from the daily thermal tides. Keep the timescales separate when comparing the surface record with orbital images.",
    ],
    [
      "question",
      23,
      "when S1 and S2 show opposed seasonal trends during the low-dust period",
      "What explains the low-dust-season behavior if aerosol optical depth no longer tracks the two tidal components?",
    ],
  ],
  "pluto-new-horizons": [
    [
      "highlight",
      1,
      "Pluto’s surface displays diverse landforms, terrain ages, albedos, colors, and composition gradients.",
      "",
    ],
    [
      "note",
      4,
      "Some features of SP suggest bulk flow similar to terrestrial glaciers.",
      "Similar-looking glacial shapes can involve very different ices. The surface material and temperature matter when comparing these features with glaciers on Earth.",
    ],
    [
      "question",
      5,
      "At present it is unclear whether this reflects a recent decrease in the mass of the atmosphere",
      "How could we distinguish real atmospheric change from differences in the calibration of radio and stellar occultations?",
    ],
  ],
  "proxima-centauri": [
    [
      "highlight",
      1,
      "We detect a signal at 5.12 ± 0.04 days with a semi-amplitude of 39 ± 7 cm s−1.",
      "",
    ],
    [
      "note",
      4,
      "Two RV offsets are adjusted between the three data subsets.",
      "The separate observing periods need their own instrumental baselines. This is an important distinction between a persistent planetary signal and a change in the measurement setup.",
    ],
    [
      "question",
      9,
      "A variation with wavelength would have been expected from a signal that was caused by a stellar spot",
      "What kinds of stellar activity could still produce a wavelength-independent signal, and what independent observation could rule them out?",
    ],
  ],
  "io-volcanic-activity": [
    ["highlight", 1, "something anomalous emerged off the limb of Io", ""],
    [
      "note",
      7,
      "Above us on the third floor of Building 264 was the Science Imaging Team.",
      "The discovery happened in the navigation workflow, close to but separate from the science imaging team. Tools used to steer the spacecraft also created an opportunity to notice something new.",
    ],
    [
      "question",
      15,
      "Such an object would not have been able to hide from discovery from the Earth.",
      "What observation finally ruled out a background object and tied the feature to Io itself?",
    ],
  ],
  "voyager-plasma-waves": [
    [
      "highlight",
      1,
      "enables the first steadily sampled measurement of the interstellar plasma density over about 10 au",
      "",
    ],
    [
      "note",
      3,
      "Knowledge of the emission mechanism is required to associate the frequency of the narrowband signal with the plasma frequency",
      "The density is inferred from the signal, rather than measured directly. The interpretation depends on understanding which process produces the emission.",
    ],
    [
      "question",
      4,
      "A much longer antenna on a future interstellar probe would be capable of robustly detecting QTN.",
      "How long would the antenna need to be, and could its spectrum distinguish quasi-thermal noise from another emission mechanism?",
    ],
  ],
  "voyager-pressure-front": [
    [
      "highlight",
      1,
      "This feature appears to be a pressure front associated with a compressive wave in the VLISM.",
      "",
    ],
    [
      "note",
      3,
      "The strong line at 2.4 kHz is interference from the spacecraft power supply.",
      "A bright feature in the spectrum is not necessarily interstellar plasma. Instrumental interference needs to be separated from the much weaker signal of interest.",
    ],
    [
      "question",
      6,
      "One could interpret the observations as overtaking one pressure front by another",
      "What additional measurement could distinguish two merging pressure fronts from a single front with a more complicated shape?",
    ],
  ],
  "uranus-magnetosphere": [
    [
      "highlight",
      1,
      "an anomalous, compressed state that we estimate to be present less than 5% of the time",
      "",
    ],
    [
      "note",
      3,
      "It is also evident that the solar wind at Uranus varies on a timescale close to the Sun’s rotation period",
      "A single flyby samples one moment in a changing environment. The longer solar-wind record gives context for deciding how representative that encounter really was.",
    ],
    [
      "question",
      5,
      "The moons Oberon and Titania and their location with respect to the Uranian magnetopause.",
      "How would time spent outside the magnetosphere affect the interpretation of magnetic measurements near Titania and Oberon?",
    ],
  ],
  "white-dwarf-colours": [
    [
      "highlight",
      1,
      "known stars that would appear yellow, green, cyan, pink, or purple if viewed close enough for their stellar discs to be resolved",
      "",
    ],
    [
      "note",
      2,
      "White dwarfs are the dense stellar remnants left behind by the majority of main sequence stars at the end of their lives.",
      "The familiar name describes a broad class, not a guarantee about visible color. Dense atmospheres and their chemistry can reshape the light that reaches our eyes.",
    ],
    [
      "question",
      8,
      "The resulting colour is a unique hue of deep salmon-pink.",
      "How much does the displayed color depend on the chosen white point and brightness, rather than the star's spectrum alone?",
    ],
  ],
};

export function studySeedAnnotations(studyId: string): Annotation[] {
  return (rows[studyId] ?? []).map(([kind, page, quote, body], index) => {
    const id = `sample-${studyId}-${index + 1}`;
    return {
      id,
      kind,
      page,
      quote,
      body,
      rects: ((anchors as Record<string, Rect[]>)[id] ?? []).map((rect) => ({
        ...rect,
      })),
      understanding: "unmarked",
      resolved: false,
      createdAt: "2026-10-20T12:00:00.000Z",
      updatedAt: "2026-10-20T12:00:00.000Z",
    };
  });
}
