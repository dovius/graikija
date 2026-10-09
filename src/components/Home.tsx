import { ArrowRight, ArrowUpRight, Camera, Heart, Lightbulb, MessageCircle, Mic, Sparkles } from 'lucide-react';
import type { Screen } from '../../shared/types';
import { RhodesPostcard } from './Illustrations';

export function Home({ navigate, startLive, history }: { navigate: (screen: Screen) => void; startLive: () => void; history?: () => void }) {
  return <main id="main-content" className="home-page">
    <section className="hero"><div className="hero-copy"><div className="destination-tag"><span className="greek-flag" aria-hidden="true" /> GRAIKIJA · RODO SALA</div><h1><span className="desktop-hero-title">Suprasti lengviau.<br /><em>Keliauti drąsiau.</em></span><span className="mobile-hero-title">Ką norite padaryti?</span></h1><p>Kalbėkite lietuviškai. Atraskite Rodo salą.<br className="desktop-break" /> O visa kita – išversime.</p><div className="hero-note"><Heart size={17} /> Paprasta naudotis. Gera turėti šalia.</div></div><RhodesPostcard /></section>
    <section className="actions-section" aria-label="Trys kelionės pagalbininkai"><div className="section-intro"><h2>Ką norite padaryti?</h2><span>Pasirinkite vieną veiksmą</span></div><div className="action-grid">
      <button className="action-card voice-card" aria-labelledby="talk-title" onClick={startLive}>
        <span className="card-top"><span className="card-icon"><Mic size={31} strokeWidth={1.7} aria-hidden="true" /></span><span className="card-tag"><span className="mini-dot" /> GYVAI</span></span>
        <span className="card-copy"><span className="card-title" id="talk-title">Versti pokalbį</span><span className="card-subtitle">Lietuviškai ⇄ graikiškai</span><span className="card-description">Kalbėkite lietuviškai.<br />Išversime abiem pusėms.</span></span>
        <span className="card-bottom"><span>Pradėti pokalbį</span><ArrowRight size={26} aria-hidden="true" /></span>
      </button>
      <button className="action-card secondary-card photo-card" aria-labelledby="photo-title" onClick={() => navigate('photo')}>
        <span className="card-top"><span className="card-icon"><Camera size={31} strokeWidth={1.7} aria-hidden="true" /></span><span className="card-decoration" aria-hidden="true">Aa <Sparkles size={13} /></span></span>
        <span className="card-copy"><span className="card-title" id="photo-title">Išversti nuotrauką</span><span className="card-description">Meniu, ženklai, bilietai<span className="desktop-card-detail"><br />Viskas aiškiai lietuviškai.</span></span></span>
        <span className="card-bottom"><span>Pasirinkti nuotrauką</span><ArrowUpRight size={26} aria-hidden="true" /></span>
      </button>
      <button className="action-card secondary-card assistant-card" aria-labelledby="ask-title" onClick={() => navigate('assistant')}>
        <span className="card-top"><span className="card-icon"><MessageCircle size={31} strokeWidth={1.7} aria-hidden="true" /></span><span className="card-decoration" aria-hidden="true">Γεια!</span></span>
        <span className="card-copy"><span className="card-title" id="ask-title">Paklausti patarimo</span><span className="card-description">Atsakymai lietuviškai<span className="desktop-card-detail"><br />Apie maistą, transportą ir kelionę.</span></span></span>
        <span className="card-bottom"><span>Užduoti klausimą</span><ArrowUpRight size={26} aria-hidden="true" /></span>
      </button>
    </div></section>
    {history && <button className="text-button home-history" onClick={history}>Ankstesni pokalbiai ir užrašai</button>}
    <aside className="home-tip"><div className="tip-icon"><Lightbulb size={23} strokeWidth={1.7} aria-hidden="true" /></div><div><strong>Mažas patarimas</strong><p>Kalbėdami laikykite telefoną tarp savęs ir pašnekovo. Kalbas atpažinsime patys.</p></div></aside>
    <div className="home-reassurance"><span><span className="little-check">✓</span> Be registracijos</span><span><span className="little-check">✓</span> Lietuviškai</span><span><span className="little-check">✓</span> Visada po ranka</span></div>
  </main>;
}
