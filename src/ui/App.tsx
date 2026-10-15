import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Heart, Search, ShieldCheck, Sparkles, UserRound, X } from 'lucide-react';

type Provider = { id: number; name: string; specialty: string };
type Appointment = { id: string; providerId: number; providerName: string; customerName: string; customerEmail: string; date: string; startTime: string; endTime: string; status: 'BOOKED' | 'CANCELLED'; createdAt: string };
type Tab = 'book' | 'manage';

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Something went wrong. Please try again.');
  return body as T;
}

function todayIST() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function prettyDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', options);
}
function prettyTime(time: string) {
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
}

export default function App() {
  const [tab, setTab] = useState<Tab>('book');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [providerId, setProviderId] = useState(1);
  const [date, setDate] = useState(todayIST);
  const [slots, setSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [created, setCreated] = useState<Appointment | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [lookup, setLookup] = useState<Appointment | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [loading, setLoading] = useState(true);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api<Provider[]>('/api/providers');
      setProviders(list);
      if (list.length && !list.some((item) => item.id === providerId)) setProviderId(list[0].id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load providers.'); }
    finally { setLoading(false); }
  }, [providerId]);

  const refreshSlots = useCallback(async () => {
    if (!providerId || !date) return;
    setAvailabilityLoading(true);
    try {
      const result = await api<{ slots: string[] }>(`/api/availability?providerId=${providerId}&date=${date}`);
      setSlots(result.slots);
    } catch (err) { setSlots([]); setError(err instanceof Error ? err.message : 'Could not load availability.'); }
    finally { setAvailabilityLoading(false); }
  }, [providerId, date]);

  const refreshAppointments = useCallback(async () => {
    setAppointmentsLoading(true);
    try { setAppointments(await api<Appointment[]>('/api/appointments')); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load appointments.'); }
    finally { setAppointmentsLoading(false); }
  }, []);

  useEffect(() => { void loadProviders(); }, [loadProviders]);
  useEffect(() => { setSelectedSlot(''); void refreshSlots(); }, [refreshSlots]);
  useEffect(() => { if (tab === 'manage') void refreshAppointments(); }, [tab, refreshAppointments]);

  const activeProvider = providers.find((p) => p.id === providerId);
  const dayOff = useMemo(() => !!date && new Date(`${date}T12:00:00Z`).getUTCDay() === 0, [date]);

  async function submitBooking(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !selectedSlot) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const booking = await api<Appointment>('/api/appointments', { method: 'POST', body: JSON.stringify({ providerId, customerName: name, customerEmail: email, date, startTime: selectedSlot }) });
      setCreated(booking); setName(''); setEmail(''); setSelectedSlot('');
      setNotice('Your appointment is confirmed.');
      await Promise.all([refreshSlots(), refreshAppointments()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not book your appointment.');
      await refreshSlots();
    } finally { setBusy(false); }
  }

  async function cancel(id: string) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await api<Appointment>(`/api/appointments/${id}/cancel`, { method: 'POST' });
      setNotice(`Appointment ${updated.id.slice(0, 8)} cancelled. Its time is now available again.`);
      setLookup(updated);
      await Promise.all([refreshAppointments(), refreshSlots()]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not cancel the appointment.'); }
    finally { setBusy(false); }
  }

  async function findBooking(event: React.FormEvent) {
    event.preventDefault(); setLookupError(''); setLookup(null);
    try { setLookup(await api<Appointment>(`/api/appointments/${encodeURIComponent(lookupId.trim())}`)); }
    catch (err) { setLookupError(err instanceof Error ? err.message : 'Booking not found.'); }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setTab('book'); }}>
        <span className="brand-mark"><Heart size={19} fill="currentColor" /></span><span>goodwell<span className="brand-dot">.</span></span>
      </a>
      <nav className="nav-tabs" aria-label="Main navigation">
        <button className={tab === 'book' ? 'nav-tab active' : 'nav-tab'} onClick={() => { setTab('book'); setCreated(null); setNotice(''); setError(''); }}>Book a visit</button>
        <button className={tab === 'manage' ? 'nav-tab active' : 'nav-tab'} onClick={() => { setTab('manage'); setNotice(''); setError(''); }}>Appointments</button>
      </nav>
      <div className="topbar-note"><span className="status-dot" />Taking appointments</div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><Sparkles size={14} /> CARE THAT FITS YOUR DAY</div>
          <h1>{tab === 'book' ? <>A little time for<br /><em>your wellbeing.</em></> : <>Your care,<br /><em>all in one place.</em></>}</h1>
          <p>{tab === 'book' ? 'Meet with a trusted specialist. Choose a time that works for you, and we’ll take care of the rest.' : 'Keep track of upcoming visits, or find a booking with your confirmation ID.'}</p>
          <div className="hero-trust"><span><ShieldCheck size={16} /> Secure & simple</span><span><Clock3 size={16} /> 30-minute visits</span></div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-sun" /><div className="art-leaf leaf-one" /><div className="art-leaf leaf-two" /><div className="art-stem" />
          <div className="art-card"><span className="art-card-icon"><Heart size={18} fill="currentColor" /></span><span><b>Make space for you</b><small>Your next step starts here</small></span><ArrowRight size={16} /></div>
          <span className="art-spark spark-a">✳</span><span className="art-spark spark-b">✦</span>
        </div>
      </section>

      {error && <div className="alert error-alert" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={16} /></button></div>}
      {notice && !created && <div className="alert success-alert" role="status"><Check size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={16} /></button></div>}

      {tab === 'book' ? <>
        {created ? <section className="confirmation-card">
          <button className="back-link" onClick={() => { setCreated(null); setNotice(''); }}><ChevronLeft size={16} /> Book another visit</button>
          <div className="confirm-icon"><Check size={29} /></div>
          <div className="eyebrow">YOU’RE ALL SET</div><h2>Your visit is confirmed.</h2>
          <p className="confirm-copy">We’ve saved your appointment. Keep your booking ID handy if you need to look it up or cancel.</p>
          <div className="confirm-details">
            <div><span>BOOKING ID</span><strong className="booking-id">{created.id}</strong></div>
            <div><span>WITH</span><strong>{created.providerName}</strong></div>
            <div><span>DATE & TIME</span><strong>{prettyDate(created.date)} · {prettyTime(created.startTime)}</strong></div>
            <div><span>VISIT FOR</span><strong>{created.customerName}</strong></div>
          </div>
          <button className="primary-btn full-btn" onClick={() => { setTab('manage'); setCreated(null); setNotice(''); }}>View appointments <ArrowRight size={17} /></button>
        </section> : <section className="booking-layout">
          <div className="booking-main">
            <div className="section-heading"><div><div className="eyebrow">LET’S GET YOU BOOKED</div><h2>Choose your visit</h2></div><span className="step-count">01 <i /> 02</span></div>
            <div className="field-label">Choose a specialist</div>
            <div className="provider-grid">
              {providers.map((provider, index) => <button key={provider.id} className={`provider-card ${providerId === provider.id ? 'selected' : ''}`} onClick={() => setProviderId(provider.id)}>
                <span className={`provider-avatar avatar-${index + 1}`}><UserRound size={22} /></span>
                <span className="provider-info"><strong>{provider.name}</strong><small>{provider.specialty}</small></span>
                <span className="radio-indicator">{providerId === provider.id && <Check size={12} />}</span>
              </button>)}
              {loading && <div className="loading-hint">Loading specialists…</div>}
              {!loading && providers.length === 0 && <p className="muted">No providers are available right now.</p>}
            </div>
            <div className="date-heading"><div className="field-label">Pick a date</div><span className="timezone-label">All times in IST <span>·</span> Asia/Kolkata</span></div>
            <div className="date-control"><CalendarDays size={18} /><input aria-label="Appointment date" type="date" value={date} min={todayIST()} onChange={(event) => setDate(event.target.value)} /><span className="date-arrows"><button aria-label="Previous date" onClick={() => changeDate(date, -1, setDate)}><ChevronLeft size={16} /></button><button aria-label="Next date" onClick={() => changeDate(date, 1, setDate)}><ChevronRight size={16} /></button></span></div>
            <div className="slots-heading"><div className="field-label">Available times</div><span className="timezone-label">30 min each</span></div>
            {availabilityLoading && !dayOff ? <div className="empty-slots"><Clock3 size={19} /><span>Checking available times…</span></div> : dayOff ? <div className="empty-slots"><CalendarDays size={19} /><span>We’re closed on Sundays. Please choose another day.</span></div> : slots.length ? <div className="slot-grid">{slots.map((slot) => <button key={slot} className={`slot-btn ${selectedSlot === slot ? 'chosen' : ''}`} onClick={() => setSelectedSlot(slot)}>{prettyTime(slot)}</button>)}</div> : <div className="empty-slots"><Clock3 size={19} /><span>No times left on this date. Try another day.</span></div>}
            <div className="schedule-note"><Clock3 size={15} /><span>Monday to Saturday <i /> 10:00 AM – 6:00 PM</span></div>
          </div>
          <aside className="booking-aside">
            <div className="aside-top"><span className="aside-icon"><CalendarDays size={20} /></span><div><div className="eyebrow">YOUR VISIT</div><h3>Appointment details</h3></div></div>
            <div className="summary-lines">
              <div><span>Specialist</span><strong>{activeProvider?.name ?? 'Select a specialist'}</strong></div>
              <div><span>Date</span><strong>{date ? prettyDate(date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Choose a date'}</strong></div>
              <div><span>Time</span><strong>{selectedSlot ? `${prettyTime(selectedSlot)} – ${prettyTime(addThirty(selectedSlot))}` : 'Choose a time'}</strong></div>
            </div>
            <div className="aside-divider" />
            <form onSubmit={submitBooking} className="customer-form">
              <div className="field-label">Your details</div>
              <label className="input-wrap"><UserRound size={16} /><input required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></label>
              <label className="input-wrap"><span className="at-symbol">@</span><input required type="email" maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" /></label>
              <button className="primary-btn full-btn" type="submit" disabled={busy || !selectedSlot || loading}>{busy ? 'Booking…' : <>Confirm appointment <ArrowRight size={17} /></>}</button>
              <p className="privacy-note"><ShieldCheck size={14} /> Your details are only used for this booking.</p>
            </form>
          </aside>
        </section>}
      </> : <section className="manage-layout">
        <div className="manage-heading"><div><div className="eyebrow">YOUR SCHEDULE</div><h2>Appointments</h2></div><span className="appointment-count">{appointments.length} {appointments.length === 1 ? 'visit' : 'visits'}</span></div>
        <div className="lookup-card"><div className="lookup-copy"><span className="lookup-icon"><Search size={18} /></span><div><strong>Find a booking</strong><p>Enter the booking ID from your confirmation.</p></div></div><form onSubmit={findBooking} className="lookup-form"><input required value={lookupId} onChange={(e) => setLookupId(e.target.value)} placeholder="Paste booking ID" aria-label="Booking ID" /><button className="secondary-btn" type="submit">Look up <ArrowRight size={16} /></button></form>
          {lookupError && <div className="lookup-error" role="alert">{lookupError}</div>}
          {lookup && <AppointmentRow appointment={lookup} busy={busy} onCancel={cancel} compact />}
        </div>
        <div className="list-title"><div><div className="eyebrow">ALL BOOKINGS</div><h3>Every visit, at a glance</h3></div><button className="refresh-btn" onClick={() => void refreshAppointments()}>Refresh</button></div>
        {appointmentsLoading ? <div className="empty-slots"><Clock3 size={19} /><span>Loading appointments…</span></div> : appointments.length ? <div className="appointment-list">{appointments.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} busy={busy} onCancel={cancel} />)}</div> : <div className="empty-appointments"><span className="empty-calendar"><CalendarDays size={23} /></span><h3>No appointments yet</h3><p>Once you book a visit, it’ll show up here.</p><button className="primary-btn" onClick={() => setTab('book')}>Book your first visit <ArrowRight size={16} /></button></div>}
      </section>}
    </main>
    <footer className="footer"><a className="brand footer-brand" href="#"><span className="brand-mark"><Heart size={15} fill="currentColor" /></span><span>goodwell<span className="brand-dot">.</span></span></a><span>Take good care of you. <i /> Mon–Sat, 10 AM–6 PM IST</span></footer>
  </div>;
}

function AppointmentRow({ appointment, busy, onCancel, compact = false }: { appointment: Appointment; busy: boolean; onCancel: (id: string) => void; compact?: boolean }) {
  return <article className={`appointment-row ${compact ? 'compact-row' : ''}`}>
    <div className="appointment-date"><strong>{prettyDate(appointment.date, { month: 'short', day: 'numeric' }).replace(',', '')}</strong><span>{prettyDate(appointment.date, { weekday: 'short' })}</span></div>
    <div className="appointment-info"><strong>{appointment.providerName}</strong><span>{prettyTime(appointment.startTime)} – {prettyTime(appointment.endTime)} <i /> {appointment.customerName}</span><small>{appointment.customerEmail}</small><small className="id-label">ID · {appointment.id}</small></div>
    <div className="appointment-actions"><span className={`status-pill ${appointment.status === 'BOOKED' ? 'booked' : 'cancelled'}`}><span />{appointment.status === 'BOOKED' ? 'Confirmed' : 'Cancelled'}</span>{appointment.status === 'BOOKED' && <button className="cancel-btn" disabled={busy} onClick={() => onCancel(appointment.id)}>Cancel visit</button>}</div>
  </article>;
}

function addThirty(time: string) { const [hour, minute] = time.split(':').map(Number); const total = hour * 60 + minute + 30; return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`; }
function changeDate(date: string, days: number, setDate: (next: string) => void) { if (!date) return; const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + days); const value = next.toISOString().slice(0, 10); if (value >= todayIST()) setDate(value); }
