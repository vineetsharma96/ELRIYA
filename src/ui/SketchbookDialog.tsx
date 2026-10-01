import Dialog from './Dialog';
import { Blossom } from './Icon';

export default function SketchbookDialog({ onClose }: { onClose(): void }) {
  return (
    <Dialog
      title="The Blossom Regulars"
      eyebrow="FIELD SKETCHBOOK • PAGE 1"
      onClose={onClose}
    >
      <div className="sketchbook-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#e08d86' }}>
          <Blossom size={24} />
          <span style={{ fontSize: '0.875rem', letterSpacing: '0.05em', textTransform: 'uppercase', fontWeight: 600 }}>
            Neko Café & Tea Pavilion
          </span>
        </div>
        <p style={{ lineHeight: 1.6, color: 'var(--text-muted, #736b66)' }}>
          <em>&ldquo;A quiet afternoon beneath the cherry blossoms. Regulars leave their ceramic cups with hand-folded origami sleeves, trusting the next traveler to return them to the cedar counter. Resting on the tray beside the cup, you notice a warm note of thanks tucked into the woodwork.&rdquo;</em>
        </p>
        <div style={{ background: 'rgba(224, 141, 134, 0.08)', borderRadius: '8px', padding: '0.75rem 1rem', border: '1px solid rgba(224, 141, 134, 0.2)' }}>
          <strong style={{ display: 'block', fontSize: '0.8125rem', color: '#5c4033', marginBottom: '0.25rem' }}>
            Local Reciprocity Unlocked
          </strong>
          <span style={{ fontSize: '0.8125rem', color: '#736b66' }}>
            You are recognized as a friend of the Blossom Bistro regulars.
          </span>
        </div>
      </div>
    </Dialog>
  );
}
