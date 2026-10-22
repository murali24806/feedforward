import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CitizenFoodRequestModal from '../components/CitizenFoodRequestModal';
import './LandingPage.css';

export default function LandingPage() {
  const navigate = useNavigate();

  // State
  const [activeSlide, setActiveSlide] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const [trackStep, setTrackStep] = useState(0);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  // Form State
  const [formState, setFormState] = useState({
    fn: '',
    ln: '',
    em: '',
    ph: '',
    rl: '',
    ms: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formFeedback, setFormFeedback] = useState(null); // { type: 'success'|'fallback', msg: string }

  // 1. Navbar scroll listener & spy
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
      const sections = ['about', 'announcements', 'contact'];
      let current = 'home';
      sections.forEach((id) => {
        const el = document.getElementById(id);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.top <= 120 && r.bottom >= 120) {
            current = id;
          }
        }
      });
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 2. Slideshow timer (auto-advance every 4.5s)
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 5);
    }, 4500);
    return () => clearInterval(timer);
  }, [activeSlide]);

  // 3. 6-Step Delivery Tracker animation
  useEffect(() => {
    const trackerTimer = setInterval(() => {
      setTrackStep((prev) => (prev + 1) % 7);
    }, 1100);
    return () => clearInterval(trackerTimer);
  }, []);

  // 4. Reveal animations via IntersectionObserver
  useEffect(() => {
    const ro = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('vis');
            ro.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll('.reveal, .reveal-l, .reveal-r').forEach((el) => ro.observe(el));

    const ao = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.querySelectorAll('.ann-card').forEach((c, i) => {
              setTimeout(() => c.classList.add('ann-in'), i * 110);
            });
            ao.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 }
    );
    document.querySelectorAll('#annGrid').forEach((el) => ao.observe(el));

    return () => {
      ro.disconnect();
      ao.disconnect();
    };
  }, []);

  // Smooth scroll helper
  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    if (id === '#') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const el = document.querySelector(id);
    if (!el) return;
    const navH = document.getElementById('navbar')?.offsetHeight || 68;
    const top = el.getBoundingClientRect().top + window.pageYOffset - navH;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  // Contact Form Submission Handler
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormFeedback(null);

    const { fn, ln, em, ph, rl, ms } = formState;
    const payload = new FormData();
    payload.append('_to', 'muralipatnala24@gmail.com');
    payload.append('_subject', `FeedForward Contact — ${fn} ${ln}`);
    payload.append('_template', 'box');
    payload.append('_captcha', 'false');
    payload.append(
      '_autoresponse',
      `Hi ${fn}, thanks for reaching out to FeedForward! We've received your message and will reply within 24 hours.`
    );
    payload.append('Name', `${fn} ${ln}`);
    payload.append('Email', em);
    payload.append('Phone', ph || 'Not provided');
    payload.append('Role', rl);
    payload.append('Message', ms);

    try {
      const res = await fetch('https://formsubmit.co/ajax/muralipatnala24@gmail.com', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: payload,
      });
      const data = await res.json();
      if (data.success === 'true' || data.success === true) {
        setFormFeedback({
          type: 'success',
          msg: `✅ Message sent successfully! We'll reply to ${em} within 24 hours.`,
        });
        setFormState({ fn: '', ln: '', em: '', ph: '', rl: '', ms: '' });
      } else {
        throw new Error('FormSubmit failed');
      }
    } catch (err) {
      const sub = encodeURIComponent(`FeedForward Contact — ${fn} ${ln}`);
      const body = encodeURIComponent(
        `Name   : ${fn} ${ln}\nEmail  : ${em}\nPhone  : ${ph}\nRole   : ${rl}\n\nMessage:\n${ms}`
      );
      window.open(
        `https://mail.google.com/mail/?view=cm&fs=1&to=muralipatnala24@gmail.com&su=${sub}&body=${body}`,
        '_blank'
      );
      setFormFeedback({
        type: 'fallback',
        msg: '📧 Gmail has been opened in a new tab with your message pre-filled. Please click Send to reach us!',
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  const icons = ['🌱', '🏢', '🚴', '📍', '📦', '🎉'];

  return (
    <div className="landing-page-root">
      {/* ── NAVBAR ────────────────────────────────────────────── */}
      <nav id="navbar" className={isScrolled ? 'scrolled' : ''}>
        <div className="container">
          <div className="nav-inner">
            <div className="nav-logo" onClick={() => scrollTo('#')} style={{ cursor: 'pointer' }}>
              <div className="nav-logo-icon">🌱</div>
              <div className="nav-logo-text">
                Feed<span>Forward</span>
              </div>
            </div>

            <div className="nav-links">
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#');
                }}
                className={activeSection === 'home' ? 'active' : ''}
              >
                Home
              </a>
              <a
                href="#about"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#about');
                }}
                className={activeSection === 'about' ? 'active' : ''}
              >
                About Us
              </a>
              <a
                href="#announcements"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#announcements');
                }}
                className={activeSection === 'announcements' ? 'active' : ''}
              >
                Announcements
              </a>
              <a
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#contact');
                }}
                className={activeSection === 'contact' ? 'active' : ''}
              >
                Contact
              </a>
            </div>

            <div className="nav-actions">
              <button
                type="button"
                onClick={() => setRequestModalOpen(true)}
                className="nav-btn-request"
                title="Free Food Assistance for Individuals & Families (No Login Required)"
              >
                🍽️ Need Food?
              </button>
              <button onClick={() => navigate('/login')} className="nav-btn-donate">
                Donate Now
              </button>
            </div>

            <button
              className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}
              id="ham"
              aria-label="Toggle menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── MOBILE MENU ───────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 998,
            backdropFilter: 'blur(3px)',
          }}
        />
      )}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`} id="mobMenu">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('#');
          }}
        >
          🏠 Home
        </a>
        <a
          href="#about"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('#about');
          }}
        >
          💡 About Us
        </a>
        <a
          href="#announcements"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('#announcements');
          }}
        >
          📢 Announcements
        </a>
        <a
          href="#contact"
          onClick={(e) => {
            e.preventDefault();
            scrollTo('#contact');
          }}
        >
          ✉️ Contact
        </a>
        <div className="mob-divider"></div>
        <button
          type="button"
          onClick={() => {
            setMobileMenuOpen(false);
            setRequestModalOpen(true);
          }}
          className="mob-request-btn"
          style={{ border: 'none', width: '100%', marginBottom: '8px' }}
        >
          🍽️ Need Food? (Free Request)
        </button>
        <button onClick={() => navigate('/login')} className="mob-cta" style={{ border: 'none', width: '100%' }}>
          🚀 Get Started / Donate
        </button>
      </div>

      {/* ── SLIDESHOW ─────────────────────────────────────────── */}
      <div id="slideshow">
        {/* Slide 1 */}
        <div className={`slide slide-bg-1 ${activeSlide === 0 ? 'active' : ''}`}>
          <div className="slide-container">
            <div className="slide-body">
              <div className="slide-tag">
                <span className="dot"></span>Smart Food Redistribution
              </div>
              <h1 className="slide-h1">
                Every meal saved is
                <br />
                <span className="hl">a life changed</span>
              </h1>
              <p className="slide-p">
                Connecting food donors, NGOs, and delivery agents to eliminate food waste and nourish
                communities.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => navigate('/login')} className="btn btn-orange">
                  🚀 Get Started Free
                </button>
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(true)}
                  className="btn"
                  style={{
                    background: '#16A34A',
                    color: '#ffffff',
                    padding: '13px 24px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  🍽️ Need Food? (No Login)
                </button>
              </div>
            </div>
            <div className="slide-emoji">
              <img
                src="/image1.png"
                alt="FeedForward Community"
                style={{ maxHeight: '240px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>

        {/* Slide 2 */}
        <div className={`slide slide-bg-2 ${activeSlide === 1 ? 'active' : ''}`}>
          <div className="slide-container">
            <div className="slide-body">
              <div className="slide-tag">
                <span className="dot"></span>For Food Donors
              </div>
              <h1 className="slide-h1">
                Post surplus food
                <br />
                <span className="hl">in 60 seconds</span>
              </h1>
              <p className="slide-p">
                Have leftover food? Post it in under a minute with GPS location. NGOs will collect it
                fast.
              </p>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={() => navigate('/login')} className="btn btn-orange">
                  🤲 Donate Food
                </button>
                <button
                  type="button"
                  onClick={() => setRequestModalOpen(true)}
                  className="btn"
                  style={{
                    background: '#16A34A',
                    color: '#ffffff',
                    padding: '13px 24px',
                    borderRadius: '12px',
                    fontSize: '15px',
                    fontWeight: 700,
                    boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  🍽️ Need Food? (Request Meals)
                </button>
              </div>
            </div>
            <div className="slide-emoji">
              <img
                src="/image2.png"
                alt="Post Surplus Food"
                style={{ maxHeight: '240px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>

        {/* Slide 3 */}
        <div className={`slide slide-bg-3 ${activeSlide === 2 ? 'active' : ''}`}>
          <div className="slide-container">
            <div className="slide-body">
              <div className="slide-tag">
                <span className="dot"></span>Live GPS Tracking
              </div>
              <h1 className="slide-h1">
                Track every delivery
                <br />
                <span className="hl">in real-time</span>
              </h1>
              <p className="slide-p">
                Watch your agent navigate live on the map. Real route, real ETA — donor and admin see
                it together.
              </p>
              <button onClick={() => navigate('/login')} className="btn btn-orange">
                📍 See Live Map
              </button>
            </div>
            <div className="slide-emoji">🗺️</div>
          </div>
        </div>

        {/* Slide 4 */}
        <div className={`slide slide-bg-4 ${activeSlide === 3 ? 'active' : ''}`}>
          <div className="slide-container">
            <div className="slide-body">
              <div className="slide-tag">
                <span className="dot"></span>Reward Points
              </div>
              <h1 className="slide-h1">
                Earn rewards for
                <br />
                <span className="hl">every donation</span>
              </h1>
              <p className="slide-p">
                Climb from Seed to Legend. Every meal you donate earns points and recognition from
                the community.
              </p>
              <button onClick={() => navigate('/login')} className="btn btn-orange">
                ⭐ Start Earning
              </button>
            </div>
            <div className="slide-emoji">⭐</div>
          </div>
        </div>

        {/* Slide 5 */}
        <div className={`slide slide-bg-5 ${activeSlide === 4 ? 'active' : ''}`}>
          <div className="slide-container">
            <div className="slide-body">
              <div className="slide-tag">
                <span className="dot"></span>24/7 Support
              </div>
              <h1 className="slide-h1">
                Chat with us on
                <br />
                <span className="hl">WhatsApp</span>
              </h1>
              <p className="slide-p">
                Have any questions or need immediate assistance? Our support team is always ready to
                help you on WhatsApp.
              </p>
              <a
                href="https://wa.me/918919009613"
                className="btn btn-orange"
                target="_blank"
                rel="noopener noreferrer"
              >
                💬 Chat Now
              </a>
            </div>
            <div className="slide-emoji">
              <a
                href="https://wa.me/918919009613"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', transition: 'transform 0.3s' }}
                onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  style={{
                    width: '140px',
                    height: '140px',
                    filter: 'drop-shadow(0 10px 20px rgba(37,211,102,0.3))',
                  }}
                >
                  <path
                    fill="#25D366"
                    d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.976L1.861 22.12l5.313-1.392a9.982 9.982 0 0 0 4.838 1.25h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.669-1.037-5.176-2.92-7.063A9.935 9.935 0 0 0 12.012 2z"
                  />
                  <path
                    fill="#FFF"
                    d="M17.472 14.307c-.276-.138-1.634-.807-1.887-.899-.253-.092-.438-.138-.621.138-.184.276-.713.899-.874 1.083-.16.184-.322.207-.598.069-.276-.138-1.167-.43-2.222-1.37-.821-.733-1.376-1.638-1.537-1.914-.16-.276-.017-.425.121-.562.125-.125.276-.322.414-.483.138-.16.184-.276.276-.46.092-.184.046-.345-.023-.483-.069-.138-.621-1.495-.85-2.047-.224-.538-.45-.465-.621-.474-.16-.008-.345-.008-.53-.008-.184 0-.483.069-.736.345-.253.276-.966.943-.966 2.299 0 1.356.989 2.668 1.127 2.851.138.184 1.943 2.966 4.704 4.086 2.012.82 2.76.666 3.267.56 1.028-.216 1.634-.667 1.864-1.31.23-.643.23-1.196.16-1.31-.068-.115-.252-.184-.528-.322z"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Slide Controls */}
        <button
          className="slide-arrow slide-arrow-prev"
          onClick={() => setActiveSlide((prev) => (prev - 1 + 5) % 5)}
          aria-label="Previous"
        >
          &#8249;
        </button>
        <button
          className="slide-arrow slide-arrow-next"
          onClick={() => setActiveSlide((prev) => (prev + 1) % 5)}
          aria-label="Next"
        >
          &#8250;
        </button>
        <div className="slide-controls">
          {[0, 1, 2, 3, 4].map((idx) => (
            <button
              key={idx}
              className={`sdot ${activeSlide === idx ? 'active' : ''}`}
              onClick={() => setActiveSlide(idx)}
              aria-label={`Slide ${idx + 1}`}
            ></button>
          ))}
        </div>
      </div>

      {/* ── MAIN HEADING ──────────────────────────────────────── */}
      <section id="main-heading">
        <div className="container">
          <div className="mh-grid">
            <div className="reveal-l">
              <div className="section-label">🌍 Making a Real Difference</div>
              <h1 className="mh-h1">
                Feed the hungry,
                <br />
                <span className="hl">reduce waste</span>,
                <br />
                change lives.
              </h1>
              <p className="mh-p">
                FeedForward connects surplus food with people in need, reducing food waste and
                helping fight hunger.
              </p>
              <div className="mh-btn-row">
                <button onClick={() => navigate('/login')} className="btn btn-orange">
                  🍲 Donate Now
                </button>
                <a
                  href="#how-it-works"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo('#how-it-works');
                  }}
                  className="btn btn-ghost"
                >
                  Learn How It Works
                </a>
              </div>
            </div>
            <div className="mh-right reveal-r">
              <img
                src="/image.webp"
                alt="FeedForward Platform Overview"
                style={{ width: '100%', maxWidth: '500px', height: 'auto', objectFit: 'contain' }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── ABOUT US ──────────────────────────────────────────── */}
      <section id="about">
        <div className="container">
          <div className="reveal">
            <div className="section-label">About FeedForward</div>
            <h2 className="section-h2">
              About <span className="hl">Us</span>
            </h2>
            <p className="section-lead" style={{ marginBottom: '52px' }}>
              FeedForward is a smart food redistribution platform connecting food donors, NGO
              admins, and delivery agents — saving meals, saving lives.
            </p>
          </div>

          <div className="how-title reveal">📌 Some Information</div>
          <div className="info-grid">
            <div className="info-card reveal" style={{ transitionDelay: '.04s' }}>
              <div className="ic-icon" style={{ background: 'rgba(252,107,26,.1)' }}>
                🌍
              </div>
              <div className="ic-title">Our Mission</div>
              <div className="ic-desc">
                Zero food waste, zero hunger. Every surplus meal deserves to reach a plate — not a
                landfill. FeedForward makes that connection instant and transparent.
              </div>
            </div>
            <div className="info-card reveal" style={{ transitionDelay: '.12s' }}>
              <div className="ic-icon" style={{ background: 'rgba(22,163,74,.1)' }}>
                🤝
              </div>
              <div className="ic-title">Community First</div>
              <div className="ic-desc">
                Donors earn reward points, NGOs get real-time updates, and delivery agents navigate
                with live GPS — every role benefits from the platform.
              </div>
            </div>
            <div className="info-card reveal" style={{ transitionDelay: '.2s' }}>
              <div className="ic-icon" style={{ background: 'rgba(124,58,237,.1)' }}>
                🔒
              </div>
              <div className="ic-title">Transparent &amp; Secure</div>
              <div className="ic-desc">
                Every donation is tracked from post to plate. Email notifications, live status
                updates, and a 6-step tracker keep every stakeholder informed.
              </div>
            </div>
            <div className="info-card reveal" style={{ transitionDelay: '.28s' }}>
              <div className="ic-icon" style={{ background: 'rgba(217,119,6,.1)' }}>
                📱
              </div>
              <div className="ic-title">Works on Any Device</div>
              <div className="ic-desc">
                Fully responsive across mobile, tablet and desktop. Donors post from their phone,
                agents navigate on the go, admins manage from their desk.
              </div>
            </div>
          </div>

          <div id="how-it-works" className="how-title reveal">
            ⚙️ How It Works!
          </div>
          <div className="flow-row reveal">
            <div className="flow-card">
              <div className="fc-n">01</div>
              <div className="fc-arrow">→</div>
              <div className="fc-icon" style={{ background: 'rgba(252,107,26,.1)' }}>
                🤲
              </div>
              <div className="fc-title">Donor Posts Food</div>
              <div
                className="fc-badge"
                style={{ background: 'rgba(252,107,26,.1)', color: 'var(--orange)' }}
              >
                📍 GPS Auto-Capture
              </div>
            </div>
            <div className="flow-card">
              <div className="fc-n">02</div>
              <div className="fc-arrow">→</div>
              <div className="fc-icon" style={{ background: 'rgba(217,119,6,.12)' }}>
                🏢
              </div>
              <div className="fc-title">Admin Accepts &amp; Assigns</div>
              <div
                className="fc-badge"
                style={{ background: 'rgba(217,119,6,.1)', color: 'var(--yellow)' }}
              >
                ⚡ Instant Assignment
              </div>
            </div>
            <div className="flow-card">
              <div className="fc-n">03</div>
              <div className="fc-icon" style={{ background: 'rgba(22,163,74,.1)' }}>
                🚴
              </div>
              <div className="fc-title">Agent Delivers Live</div>
              <div
                className="fc-badge"
                style={{ background: 'rgba(22,163,74,.1)', color: 'var(--green)' }}
              >
                🗺️ Live Navigation
              </div>
            </div>
          </div>

          {/* 6-Step Delivery Tracker */}
          <div className="track-panel reveal">
            <div className="tp-title">📦 6-Step Delivery Tracker</div>
            <div className="tp-sub">
              Every donation moves through 6 milestones — donors see every step in real-time
            </div>
            <div className="track-row" id="trackBar">
              {[
                { label: 'Food\nPosted' },
                { label: 'NGO\nAccepted' },
                { label: 'Agent\nAssigned' },
                { label: 'En\nRoute' },
                { label: 'Picked\nUp' },
                { label: 'Delivered!' },
              ].map((step, idx) => {
                const isDone = idx < trackStep;
                const isActive = idx === trackStep;
                return (
                  <div
                    key={idx}
                    className={`t-step ${isDone ? 't-done' : ''} ${isActive ? 't-active' : ''}`}
                  >
                    <div className="t-dot">{isDone ? '✅' : icons[idx]}</div>
                    <div className="t-lbl">
                      {step.label.split('\n').map((l, i) => (
                        <React.Fragment key={i}>
                          {l}
                          <br />
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="live-panel reveal">
            <div className="lp-icon">🗺️</div>
            <div className="lp-text">
              <h3>Monitor Live Delivery Agent Tracking</h3>
              <p>
                Watch your delivery agent navigate to the pickup location in real-time. Live route
                with ETA countdown — both the donor and NGO admin can monitor exact position.
              </p>
            </div>
            <div className="lp-badge">
              <div className="ldot"></div>
              <span>GPS Live</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── ANNOUNCEMENTS ─────────────────────────────────────── */}
      <section id="announcements">
        <div className="container">
          <div className="reveal">
            <div className="section-label">Latest Updates</div>
            <h2 className="section-h2">
              <span className="hl">Announcements</span>
            </h2>
            <p className="section-lead" style={{ marginBottom: '36px' }}>
              Stay updated with the latest news and milestones from FeedForward.
            </p>
          </div>

          {/* Scrolling Ticker */}
          <div className="ticker-outer reveal">
            <div className="ticker-label">📢 LIVE</div>
            <div className="ticker-track">
              <div className="ti">
                <span className="td"></span>🎉 FeedForward live in Vijayawada!{' '}
                <span className="ti-badge">New</span>
              </div>
              <div className="ti">
                <span className="td"></span>🍱 10,000 meals redistributed — thank you!
              </div>
              <div className="ti">
                <span className="td"></span>📍 Live GPS tracking now available{' '}
                <span className="ti-badge">Feature</span>
              </div>
              <div className="ti">
                <span className="td"></span>🚴 Recruiting delivery agents — join today!
              </div>
              <div className="ti">
                <span className="td"></span>⭐ Reward points system launched{' '}
                <span className="ti-badge">New</span>
              </div>
              <div className="ti">
                <span className="td"></span>🏢 3 new NGO partners joined this month
              </div>
              <div className="ti">
                <span className="td"></span>📱 Mobile dashboard now available
              </div>
              <div className="ti">
                <span className="td"></span>🎉 FeedForward live in Vijayawada!{' '}
                <span className="ti-badge">New</span>
              </div>
              <div className="ti">
                <span className="td"></span>🍱 10,000 meals redistributed — thank you!
              </div>
              <div className="ti">
                <span className="td"></span>📍 Live GPS tracking now available{' '}
                <span className="ti-badge">Feature</span>
              </div>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="ann-grid" id="annGrid">
            <div className="ann-card">
              <div className="ann-pill" style={{ background: 'rgba(252,107,26,.1)', color: 'var(--orange)' }}>
                🚀 Launch
              </div>
              <div className="ann-title">FeedForward Goes Live in Vijayawada</div>
              <div className="ann-body">
                FeedForward is officially live in Vijayawada, AP. Donors, NGOs and delivery agents can
                now sign up and start making a difference today.
              </div>
              <div className="ann-date">June 10, 2026</div>
            </div>

            <div className="ann-card">
              <div className="ann-pill" style={{ background: 'rgba(217,119,6,.1)', color: 'var(--yellow)' }}>
                ✨ Feature
              </div>
              <div className="ann-title">Live GPS Navigation Now Available</div>
              <div className="ann-body">
                Delivery agents now share real-time location while navigating. Donors and admins watch
                the route live on an interactive map with ETA.
              </div>
              <div className="ann-date">June 8, 2026</div>
            </div>

            <div className="ann-card">
              <div className="ann-pill" style={{ background: 'rgba(22,163,74,.1)', color: 'var(--green)' }}>
                🏆 Milestone
              </div>
              <div className="ann-title">10,000 Meals Successfully Redistributed</div>
              <div className="ann-body">
                Thanks to our community of donors, NGO partners, and delivery agents, FeedForward has
                redistributed over 10,000 meals to those in need.
              </div>
              <div className="ann-date">June 5, 2026</div>
            </div>

            <div className="ann-card">
              <div className="ann-pill" style={{ background: 'rgba(124,58,237,.1)', color: 'var(--purple)' }}>
                ⭐ Rewards
              </div>
              <div className="ann-title">Reward Points System Launched</div>
              <div className="ann-body">
                Donors now earn points for every food donation. Climb from Seed to Legend — get
                recognized for your contributions to the community.
              </div>
              <div className="ann-date">June 2, 2026</div>
            </div>

            <div className="ann-card">
              <div className="ann-pill" style={{ background: 'rgba(37,99,235,.1)', color: 'var(--blue)' }}>
                🤝 Partners
              </div>
              <div className="ann-title">3 New NGO Partners Join This Month</div>
              <div className="ann-body">
                We welcome three new NGO partners to the FeedForward network. More NGOs means food
                reaches more communities faster than ever.
              </div>
              <div className="ann-date">May 28, 2026</div>
            </div>

            <div className="ann-card">
              <div className="ann-pill" style={{ background: 'rgba(252,107,26,.1)', color: 'var(--orange)' }}>
                🚴 Agents
              </div>
              <div className="ann-title">Delivery Agent Recruitment Open</div>
              <div className="ann-body">
                We are recruiting delivery agents across Vijayawada. Join FeedForward and help
                connect food to those who need it most.
              </div>
              <div className="ann-date">May 20, 2026</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CONTACT US ────────────────────────────────────────── */}
      <section id="contact">
        <div className="container">
          <div className="reveal">
            <div className="section-label">Get In Touch</div>
            <h2 className="section-h2">
              Contact <span className="hl">Us</span>
            </h2>
            <p className="section-lead">
              Questions, partnerships, or ready to join? Reach out — we respond within 24 hours.
            </p>
          </div>

          <div className="contact-grid">
            <div className="reveal-l">
              <div className="ci-items">
                <div className="ci-item">
                  <div className="ci-ico">📧</div>
                  <div>
                    <div className="ci-lbl">Email</div>
                    <a href="mailto:muralipatnala24@gmail.com" className="ci-val">
                      muralipatnala24@gmail.com
                    </a>
                  </div>
                </div>

                <div className="ci-item">
                  <div className="ci-ico">📞</div>
                  <div>
                    <div className="ci-lbl">Phone</div>
                    <a href="tel:+918919009613" className="ci-val">
                      +91 89190 09613
                    </a>
                  </div>
                </div>

                <div className="ci-item">
                  <div className="ci-ico">📍</div>
                  <div>
                    <div className="ci-lbl">Address</div>
                    <div className="ci-val">
                      Kurmannapalem, Visakhapatnam,
                      <br />
                      Andhra Pradesh, India
                    </div>
                  </div>
                </div>

                <div className="ci-item">
                  <div className="ci-ico">⏰</div>
                  <div>
                    <div className="ci-lbl">Response Time</div>
                    <div className="ci-val">Within 24 hours</div>
                  </div>
                </div>
              </div>

              <div className="join-cta-box">
                <h4>Join FeedForward Today</h4>
                <p>Donor, NGO admin, or delivery agent — sign up and start making a difference.</p>
                <button
                  onClick={() => navigate('/login')}
                  className="btn btn-orange"
                  style={{ fontSize: '14px', padding: '11px 22px' }}
                >
                  🚀 Get Started Free
                </button>
              </div>
            </div>

            <div className="reveal-r">
              <div className="cf-card">
                <div className="cf-head">Send us a message</div>
                <div className="cf-sub">Fill the form — we'll reply to you within 24 hours</div>
                <form id="cForm" onSubmit={handleFormSubmit}>
                  <div className="form-row">
                    <div className="fg">
                      <label className="fl">First Name *</label>
                      <input
                        type="text"
                        className="fi"
                        placeholder="Sai"
                        required
                        value={formState.fn}
                        onChange={(e) => setFormState({ ...formState, fn: e.target.value })}
                      />
                    </div>
                    <div className="fg">
                      <label className="fl">Last Name</label>
                      <input
                        type="text"
                        className="fi"
                        placeholder="Kumar"
                        value={formState.ln}
                        onChange={(e) => setFormState({ ...formState, ln: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="fg">
                    <label className="fl">Email *</label>
                    <input
                      type="email"
                      className="fi"
                      placeholder="you@example.com"
                      required
                      value={formState.em}
                      onChange={(e) => setFormState({ ...formState, em: e.target.value })}
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">Phone</label>
                    <input
                      type="tel"
                      className="fi"
                      placeholder="+91 98765 43210"
                      value={formState.ph}
                      onChange={(e) => setFormState({ ...formState, ph: e.target.value })}
                    />
                  </div>

                  <div className="fg">
                    <label className="fl">I am interested as *</label>
                    <select
                      className="fi"
                      required
                      value={formState.rl}
                      onChange={(e) => setFormState({ ...formState, rl: e.target.value })}
                    >
                      <option value="">Select your role</option>
                      <option>Food Donor</option>
                      <option>NGO / Admin</option>
                      <option>Delivery Agent</option>
                      <option>Just curious</option>
                    </select>
                  </div>

                  <div className="fg">
                    <label className="fl">Message *</label>
                    <textarea
                      className="fi"
                      placeholder="Tell us how we can help..."
                      required
                      value={formState.ms}
                      onChange={(e) => setFormState({ ...formState, ms: e.target.value })}
                    ></textarea>
                  </div>

                  <button type="submit" className="btn-send" disabled={formSubmitting}>
                    <span>{formSubmitting ? '⏳ Sending…' : '📩 Send Message'}</span>
                  </button>

                  {formFeedback && (
                    <div
                      className="form-ok show"
                      style={
                        formFeedback.type === 'fallback'
                          ? {
                              display: 'block',
                              background: 'rgba(217,119,6,.08)',
                              border: '1px solid rgba(217,119,6,.25)',
                              color: '#92400E',
                              fontWeight: 600,
                              fontSize: '14px',
                              padding: '14px',
                              borderRadius: '12px',
                              marginTop: '14px',
                            }
                          : {}
                      }
                    >
                      {formFeedback.msg}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer>
        <div className="container">
          <div className="footer-inner">
            <div className="fl-logo" onClick={() => scrollTo('#')} style={{ cursor: 'pointer' }}>
              <div className="fl-ico">🌱</div>
              <div className="fl-name">FeedForward</div>
            </div>
            <div className="fl-copy">© 2026 FeedForward. Made with ❤️ to reduce food waste.</div>
            <div className="fl-links">
              <a
                href="#home"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#');
                }}
              >
                Home
              </a>
              <a
                href="#about"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#about');
                }}
              >
                About
              </a>
              <a
                href="#announcements"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#announcements');
                }}
              >
                News
              </a>
              <a
                href="#contact"
                onClick={(e) => {
                  e.preventDefault();
                  scrollTo('#contact');
                }}
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* ── WHATSAPP FLOATING BUTTON ──────────────────────────── */}
      <a
        href="https://wa.me/918919009613"
        className="whatsapp-float"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path
            fill="#25D366"
            d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 0 0 1.333 4.976L1.861 22.12l5.313-1.392a9.982 9.982 0 0 0 4.838 1.25h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.669-1.037-5.176-2.92-7.063A9.935 9.935 0 0 0 12.012 2z"
          />
          <path
            fill="#FFF"
            d="M17.472 14.307c-.276-.138-1.634-.807-1.887-.899-.253-.092-.438-.138-.621.138-.184.276-.713.899-.874 1.083-.16.184-.322.207-.598.069-.276-.138-1.167-.43-2.222-1.37-.821-.733-1.376-1.638-1.537-1.914-.16-.276-.017-.425.121-.562.125-.125.276-.322.414-.483.138-.16.184-.276.276-.46.092-.184.046-.345-.023-.483-.069-.138-.621-1.495-.85-2.047-.224-.538-.45-.465-.621-.474-.16-.008-.345-.008-.53-.008-.184 0-.483.069-.736.345-.253.276-.966.943-.966 2.299 0 1.356.989 2.668 1.127 2.851.138.184 1.943 2.966 4.704 4.086 2.012.82 2.76.666 3.267.56 1.028-.216 1.634-.667 1.864-1.31.23-.643.23-1.196.16-1.31-.068-.115-.252-.184-.528-.322z"
          />
        </svg>
      </a>

      {/* ── CITIZEN / BENEFICIARY FOOD REQUEST MODAL (NO LOGIN REQUIRED) ── */}
      <CitizenFoodRequestModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
      />
    </div>
  );
}
