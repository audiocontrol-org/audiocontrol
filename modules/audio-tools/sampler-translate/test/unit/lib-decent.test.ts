import { expect } from "chai";
import { decent } from "../../src/lib-decent";

describe("lib-decent", () => {
    describe("decent.newProgramFromBuffer", () => {
        it("should parse a valid DecentSampler program with groups and samples", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
    <group name="Group1">
      <sample path="sample1.wav"
              rootnote="C3"
              lonote="C2"
              hinote="C4"
              lovel="0"
              hivel="127"
              attack="0.01"
              attackcurve="0"
              decay="0.1"
              decaycurve="0"
              sustain="1.0"
              release="0.5"
              releasecurve="0"
              pan="0"
              pitchkeytrack="1"
              volume="0dB"
              start="0"
              end="1"/>
    </group>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            expect(program).to.exist;
            expect(program.groups).to.have.length(1);
            expect(program.groups[0].name).to.equal("Group1");
            expect(program.groups[0].samples).to.have.length(1);

            const sample = program.groups[0].samples[0];
            expect(sample.path).to.equal("sample1.wav");
            expect(sample.rootNote).to.equal(60); // C3
            expect(sample.loNote).to.equal(48); // C2
            expect(sample.hiNote).to.equal(72); // C4
            expect(sample.loVel).to.equal(0);
            expect(sample.hiVel).to.equal(127);
            expect(sample.attack).to.equal(0.01);
            expect(sample.attackCurve).to.equal(0);
            expect(sample.decay).to.equal(0.1);
            expect(sample.decayCurve).to.equal(0);
            expect(sample.sustain).to.equal(1.0);
            expect(sample.release).to.equal(0.5);
            expect(sample.releaseCurve).to.equal(0);
            expect(sample.pan).to.equal(0);
            expect(sample.pitchKeyTrack).to.equal(1);
            expect(sample.volume).to.equal("0dB");
            expect(sample.start).to.equal(0);
            expect(sample.end).to.equal(1);
        });

        it("should handle multiple groups", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
    <group name="Group1">
      <sample path="sample1.wav" rootnote="C3" lonote="C2" hinote="C4"/>
    </group>
    <group name="Group2">
      <sample path="sample2.wav" rootnote="D3" lonote="D2" hinote="D4"/>
    </group>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            expect(program.groups).to.have.length(2);
            expect(program.groups[0].name).to.equal("Group1");
            expect(program.groups[1].name).to.equal("Group2");
        });

        it("should handle multiple samples in a group", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
    <group name="VelocityLayers">
      <sample path="soft.wav" rootnote="C3" lovel="0" hivel="63"/>
      <sample path="loud.wav" rootnote="C3" lovel="64" hivel="127"/>
    </group>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            expect(program.groups).to.have.length(1);
            expect(program.groups[0].samples).to.have.length(2);
            expect(program.groups[0].samples[0].path).to.equal("soft.wav");
            expect(program.groups[0].samples[1].path).to.equal("loud.wav");
        });

        it("should use default group name if not provided", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
    <group>
      <sample path="sample1.wav" rootnote="C3"/>
    </group>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            expect(program.groups).to.have.length(1);
            expect(program.groups[0].name).to.equal("01");
        });

        it("should fallback rootNote to loNote if rootNote is NaN", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
    <group name="Test">
      <sample path="sample.wav" lonote="C3" hinote="C4"/>
    </group>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            const sample = program.groups[0].samples[0];
            expect(sample.rootNote).to.equal(60); // Falls back to loNote (C3)
        });

        it("should fallback rootNote to hiNote if both rootNote and loNote are NaN", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
    <group name="Test">
      <sample path="sample.wav" hinote="C4"/>
    </group>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            const sample = program.groups[0].samples[0];
            expect(sample.rootNote).to.equal(72); // Falls back to hiNote (C4)
        });

        it("should parse numeric note values", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
    <group name="Test">
      <sample path="sample.wav" rootnote="60" lonote="48" hinote="72"/>
    </group>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            const sample = program.groups[0].samples[0];
            expect(sample.rootNote).to.equal(60);
            expect(sample.loNote).to.equal(48);
            expect(sample.hiNote).to.equal(72);
        });

        it("should handle empty groups section", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            expect(program.groups).to.have.length(0);
        });

        it("should parse note names with sharps and flats", async () => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?>
<decentsampler>
  <groups>
    <group name="Test">
      <sample path="sample.wav" rootnote="C#3" lonote="Db3" hinote="D3"/>
    </group>
  </groups>
</decentsampler>`;

            const buffer = Buffer.from(xml);
            const program = await decent.newProgramFromBuffer(buffer);

            const sample = program.groups[0].samples[0];
            expect(sample.rootNote).to.equal(61); // C#3 / Db3
            expect(sample.loNote).to.equal(61); // Db3
            expect(sample.hiNote).to.equal(62); // D3
        });
    });
});
