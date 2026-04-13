import React, { useEffect, useState } from 'react'
import logo from './assets/logo.jpeg'

const API_BASE_URL = 'http://127.0.0.1:8000'

const SKILL_OPTIONS = ['Python', 'Neo4j', 'FastAPI', 'React', 'JavaScript', 'SQL', 'Testing', 'Selenium', 'Cypher', 'ETL']

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f4f7f9',
    color: '#182026',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  shell: {
    maxWidth: 1180,
    margin: '0 auto',
    padding: '24px 20px 52px',
  },
  nav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
    marginBottom: 28,
  },
  brandButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    border: 0,
    background: 'transparent',
    padding: 0,
    cursor: 'pointer',
    color: 'inherit',
  },
  logo: {
    width: 50,
    height: 50,
    objectFit: 'contain',
    borderRadius: 6,
  },
  logoBox: {
    width: 64,
    height: 64,
    display: 'grid',
    placeItems: 'center',
    background: '#ffffff',
    border: '1px solid #d9e2e8',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(18, 32, 38, 0.08)',
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  button: {
    padding: '10px 14px',
    border: '1px solid #aeb9c2',
    borderRadius: 6,
    background: '#ffffff',
    color: '#182026',
    cursor: 'pointer',
    fontWeight: 600,
  },
  primaryButton: {
    padding: '10px 16px',
    border: '1px solid #215d6e',
    borderRadius: 6,
    background: '#215d6e',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 700,
  },
  panel: {
    background: '#ffffff',
    border: '1px solid #d8e1e7',
    borderRadius: 8,
    padding: 22,
  },
  section: {
    marginTop: 22,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '11px 12px',
    border: '1px solid #b8c5ce',
    borderRadius: 6,
    fontSize: 14,
    background: '#ffffff',
    color: '#182026',
  },
  label: {
    display: 'grid',
    gap: 6,
    fontSize: 13,
    color: '#4a5963',
    fontWeight: 650,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 14,
  },
  card: {
    background: '#ffffff',
    border: '1px solid #d8e1e7',
    borderRadius: 8,
    padding: 18,
  },
  status: {
    padding: 12,
    border: '1px solid #b8c5ce',
    borderRadius: 6,
    background: '#ffffff',
    marginBottom: 18,
  },
  muted: {
    color: '#63717a',
    lineHeight: 1.5,
  },
  tag: {
    display: 'inline-block',
    padding: '5px 8px',
    borderRadius: 6,
    background: '#e8f1f3',
    color: '#215d6e',
    fontSize: 12,
    fontWeight: 700,
    marginRight: 6,
    marginBottom: 6,
  },
}

function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = window.localStorage.getItem('profile_manager_user')
    return saved ? JSON.parse(saved) : null
  })
  const [message, setMessage] = useState('')

  const navigate = (nextPath) => {
    window.history.pushState({}, '', nextPath)
    setPath(nextPath)
    setMessage('')
  }

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    requestJson('/session')
      .then((data) => updateCurrentUser(data.user))
      .catch(() => {
        window.localStorage.removeItem('profile_manager_user')
        setCurrentUser(null)
      })
  }, [])

  const login = (user) => {
    window.localStorage.setItem('profile_manager_user', JSON.stringify(user))
    setCurrentUser(user)
    navigate('/dashboard')
  }

  const updateCurrentUser = (user) => {
    window.localStorage.setItem('profile_manager_user', JSON.stringify(user))
    setCurrentUser(user)
  }

  const logout = async () => {
    try {
      await requestJson('/logout', { method: 'POST' })
    } catch {
      // La salida local se mantiene aunque la cookie ya no exista.
    }
    window.localStorage.removeItem('profile_manager_user')
    setCurrentUser(null)
    navigate('/')
  }

  return (
    <main style={styles.page}>
      <div style={styles.shell}>
        <Header currentUser={currentUser} navigate={navigate} logout={logout} />
        {message ? <p style={styles.status}>{message}</p> : null}

        {path === '/' ? <Home navigate={navigate} /> : null}
        {path === '/register' ? <RegisterPage navigate={navigate} setMessage={setMessage} /> : null}
        {path === '/login' ? <LoginPage login={login} setMessage={setMessage} /> : null}
        {path === '/dashboard' ? <Dashboard currentUser={currentUser} navigate={navigate} setMessage={setMessage} updateCurrentUser={updateCurrentUser} /> : null}
        {!['/', '/register', '/login', '/dashboard'].includes(path) ? <NotFound navigate={navigate} /> : null}
      </div>
    </main>
  )
}

function Header({ currentUser, navigate, logout }) {
  return (
    <header style={styles.nav}>
      <button onClick={() => navigate('/')} style={styles.brandButton}>
        <span style={styles.logoBox}>
          <img src={logo} alt="Profile Manager" style={styles.logo} />
        </span>
        <div style={{ textAlign: 'left' }}>
          <strong style={{ display: 'block', fontSize: 24, letterSpacing: 0 }}>Profile Manager</strong>
          <span style={styles.muted}>Recomendaciones laborales explicables</span>
        </div>
      </button>

      <nav style={styles.navActions}>
        <button style={styles.button} onClick={() => navigate('/')}>Inicio</button>
        {!currentUser ? <button style={styles.button} onClick={() => navigate('/register')}>Crear cuenta</button> : null}
        {!currentUser ? <button style={styles.primaryButton} onClick={() => navigate('/login')}>Ingresar</button> : null}
        {currentUser ? <button style={styles.primaryButton} onClick={() => navigate('/dashboard')}>Dashboard</button> : null}
        {currentUser ? <button style={styles.button} onClick={logout}>Salir</button> : null}
      </nav>
    </header>
  )
}

function Home({ navigate }) {
  return (
    <>
      <section style={{ ...styles.panel, padding: 34 }}>
        <p style={{ ...styles.tag, marginBottom: 12 }}>Matching laboral con grafo de conocimiento</p>
        <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: '0 0 14px' }}>
          Descubre oportunidades alineadas con tu perfil profesional
        </h1>
        <p style={{ ...styles.muted, maxWidth: 820, fontSize: 18 }}>
          Profile Manager estructura la informacion del candidato, conecta habilidades con roles y vacantes,
          y entrega recomendaciones con una explicacion clara de cada coincidencia.
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
          <button style={styles.primaryButton} onClick={() => navigate('/register')}>Crear cuenta</button>
          <button style={styles.button} onClick={() => navigate('/login')}>Ingresar</button>
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.grid}>
          <InfoCard title="Perfil completo" text="Registra datos de contacto, experiencia, educacion, skills, rol objetivo y preferencias laborales." />
          <InfoCard title="Recomendaciones trazables" text="Cada vacante recomendada incluye score, skills coincidentes y criterios de afinidad." />
          <InfoCard title="Seguimiento del proceso" text="Simula postulaciones y consulta el estado de avance desde un tablero simple." />
        </div>
      </section>
    </>
  )
}

function RegisterPage({ navigate, setMessage }) {
  const [form, setForm] = useState({
    username: '',
    nombre: '',
    email: '',
    password: '',
    fecha_nacimiento: '',
  })

  const submitRegister = async (event) => {
    event.preventDefault()
    try {
      const data = await requestJson('/users', {
        method: 'POST',
        body: JSON.stringify({
          username: form.username.trim(),
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          fecha_nacimiento: form.fecha_nacimiento,
          edad: calculateAge(form.fecha_nacimiento),
          skills: [],
          intereses: [],
        }),
      })
      setMessage(`Perfil creado. Tu ID de candidato es ${data.user.id}.`)
      navigate('/login')
    } catch (error) {
      setMessage(`No fue posible crear el perfil: ${error.message}`)
    }
  }

  return (
    <section style={{ ...styles.panel, maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Crear cuenta</h2>
      <p style={styles.muted}>
        Registra tus datos basicos. El perfil profesional se completa despues de iniciar sesion.
      </p>
      <form onSubmit={submitRegister} style={styles.grid}>
        <Field label="Nombre de usuario">
          <input style={styles.input} name="username" value={form.username} onChange={updateForm(setForm)} required />
        </Field>
        <Field label="Nombre completo">
          <input style={styles.input} name="nombre" value={form.nombre} onChange={updateForm(setForm)} required />
        </Field>
        <Field label="Email">
          <input style={styles.input} name="email" type="email" value={form.email} onChange={updateForm(setForm)} required />
        </Field>
        <Field label="Contrasena">
          <input style={styles.input} name="password" type="password" value={form.password} onChange={updateForm(setForm)} required />
        </Field>
        <Field label="Fecha de nacimiento">
          <input style={styles.input} name="fecha_nacimiento" type="date" value={form.fecha_nacimiento} onChange={updateForm(setForm)} required />
        </Field>
        <button type="submit" style={styles.primaryButton}>Crear cuenta</button>
      </form>
    </section>
  )
}

function LoginPage({ login, setMessage }) {
  const [form, setForm] = useState({ email: '', password: '' })

  const submitLogin = async (event) => {
    event.preventDefault()
    try {
      const data = await requestJson('/login', {
        method: 'POST',
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password.trim(),
        }),
      })
      setMessage(`Sesion iniciada para ${data.user.nombre}.`)
      login(data.user)
    } catch (error) {
      setMessage(`No fue posible iniciar sesion: ${error.message}`)
    }
  }

  return (
    <section style={{ ...styles.panel, maxWidth: 680 }}>
      <h2 style={{ marginTop: 0 }}>Ingreso de candidato</h2>
      <p style={styles.muted}>Accede al dashboard para consultar recomendaciones y postulaciones.</p>
      <form onSubmit={submitLogin} style={styles.grid}>
        <Field label="Email">
          <input style={styles.input} name="email" type="email" value={form.email} onChange={updateForm(setForm)} required />
        </Field>
        <Field label="Password">
          <input style={styles.input} name="password" type="password" value={form.password} onChange={updateForm(setForm)} required />
        </Field>
        <button type="submit" style={styles.primaryButton}>Ingresar</button>
      </form>
    </section>
  )
}

function Dashboard({ currentUser, navigate, setMessage, updateCurrentUser }) {
  const [recommendations, setRecommendations] = useState([])
  const [applications, setApplications] = useState([])
  const [vacancies, setVacancies] = useState([])
  const [profileForm, setProfileForm] = useState(() => profileFormFromUser(currentUser))
  const [selectedSkills, setSelectedSkills] = useState(currentUser?.skills ?? [])

  const loadData = async () => {
    const [recommendationsData, applicationsData, vacanciesData] = await Promise.all([
      requestJson(`/recommendations/${currentUser.id}`),
      requestJson(`/applications/${currentUser.id}`),
      requestJson('/vacancies'),
    ])
    setRecommendations(recommendationsData.recommendations ?? [])
    setApplications(applicationsData.applications ?? [])
    setVacancies(vacanciesData.vacancies ?? [])
  }

  useEffect(() => {
    if (currentUser) {
      setProfileForm(profileFormFromUser(currentUser))
      setSelectedSkills(currentUser.skills ?? [])
      loadData().catch((error) => setMessage(`No se pudieron cargar los datos: ${error.message}`))
    }
  }, [currentUser])

  if (!currentUser) {
    return (
      <section style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>Acceso requerido</h2>
        <p style={styles.muted}>Inicia sesion para consultar recomendaciones y postulaciones.</p>
        <button style={styles.primaryButton} onClick={() => navigate('/login')}>Ir al login</button>
      </section>
    )
  }

  const applyToVacancy = async (vacancy) => {
    try {
      await requestJson('/applications', {
        method: 'POST',
        body: JSON.stringify({
          user_id: currentUser.id,
          vacancy_id: vacancy.id,
          notas: 'Postulacion asistida desde Profile Manager',
        }),
      })
      setMessage(`Postulacion registrada para ${vacancy.titulo}.`)
      await loadData()
    } catch (error) {
      setMessage(`No fue posible registrar la postulacion: ${error.message}`)
    }
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    try {
      const data = await requestJson('/users', {
        method: 'POST',
        body: JSON.stringify({
          id: currentUser.id,
          username: currentUser.username ?? currentUser.nombre,
          nombre: profileForm.nombre.trim() || currentUser.nombre,
          email: currentUser.email,
          fecha_nacimiento: currentUser.fecha_nacimiento,
          edad: currentUser.edad,
          ...buildProfessionalPayload(profileForm, selectedSkills),
        }),
      })
      updateCurrentUser(data.user)
      setMessage('Perfil profesional actualizado.')
      await loadData()
    } catch (error) {
      setMessage(`No fue posible actualizar el perfil: ${error.message}`)
    }
  }

  return (
    <>
      <section style={styles.panel}>
        <p style={styles.tag}>Candidato activo</p>
        <h2 style={{ marginTop: 0 }}>{currentUser.nombre}</h2>
        <p style={styles.muted}>
          Rol objetivo: <strong>{currentUser.rol_objetivo ?? currentUser.ocupacion ?? 'Pendiente'}</strong>
        </p>
        <div>
          {(currentUser.skills ?? []).map((skill) => <span key={skill} style={styles.tag}>{skill}</span>)}
        </div>
      </section>

      <section style={styles.section}>
        <ProfessionalProfileForm
          form={profileForm}
          setForm={setProfileForm}
          selectedSkills={selectedSkills}
          setSelectedSkills={setSelectedSkills}
          onSubmit={saveProfile}
        />
      </section>

      <section style={styles.section}>
        <h2>Recomendaciones</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          {recommendations.map((item) => (
            <article key={item.vacancy.id} style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px' }}>{item.vacancy.titulo}</h3>
                  <p style={{ ...styles.muted, margin: 0 }}>{item.vacancy.empresa} · {item.vacancy.modalidad} · {item.vacancy.ubicacion}</p>
                </div>
                <strong style={{ fontSize: 28, color: '#215d6e' }}>{item.score}</strong>
              </div>
              <p style={{ ...styles.muted, marginBottom: 10 }}><strong>Explicacion:</strong> {item.explanation}</p>
              {item.score_breakdown ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={styles.tag}>Skills {item.score_breakdown.skills}/65</span>
                  <span style={styles.tag}>Rol {item.score_breakdown.role}/25</span>
                  <span style={styles.tag}>Modalidad {item.score_breakdown.modality}/10</span>
                </div>
              ) : null}
              <div>
                {(item.matched_skills ?? []).map((skill) => <span key={skill} style={{ ...styles.tag, background: '#dff4e5', color: '#1e6b3b' }}>{skill}</span>)}
                {(item.missing_skills ?? []).map((skill) => <span key={skill} style={{ ...styles.tag, background: '#f3e7e3', color: '#8a3d24' }}>{skill}</span>)}
              </div>
              <button style={{ ...styles.primaryButton, marginTop: 12 }} onClick={() => applyToVacancy(item.vacancy)}>
                Registrar postulacion
              </button>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <div style={styles.grid}>
          <DataPanel title="Postulaciones" empty="Aun no hay postulaciones registradas.">
            {applications.map((item) => (
              <li key={item.application.id}>
                <strong>{item.vacancy.titulo}</strong><br />
                Estado: {item.application.estado}
              </li>
            ))}
          </DataPanel>
          <DataPanel title="Vacantes disponibles" empty="No hay vacantes cargadas.">
            {vacancies.map((vacancy) => (
              <li key={vacancy.id}>
                <strong>{vacancy.titulo}</strong><br />
                {vacancy.rol} · {(vacancy.skills ?? []).join(', ')}
              </li>
            ))}
          </DataPanel>
        </div>
      </section>
    </>
  )
}

function ProfessionalProfileForm({ form, setForm, selectedSkills, setSelectedSkills, onSubmit }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 22 }}>
      <FormBlock title="Perfil profesional" description="Completa tu informacion para mejorar las recomendaciones.">
        <Field label="Nombre completo"><input style={styles.input} name="nombre" value={form.nombre} onChange={updateForm(setForm)} required /></Field>
        <Field label="Telefono"><input style={styles.input} name="telefono" value={form.telefono} onChange={updateForm(setForm)} /></Field>
        <Field label="Ciudad"><input style={styles.input} name="ciudad" value={form.ciudad} onChange={updateForm(setForm)} /></Field>
        <Field label="Ocupacion actual"><input style={styles.input} name="ocupacion" value={form.ocupacion} onChange={updateForm(setForm)} /></Field>
        <Field label="Rol objetivo"><input style={styles.input} name="rol_objetivo" value={form.rol_objetivo} onChange={updateForm(setForm)} /></Field>
        <Field label="Modalidad">
          <select style={styles.input} name="modalidad" value={form.modalidad} onChange={updateForm(setForm)}>
            <option>Remoto</option>
            <option>Hibrido</option>
            <option>Presencial</option>
          </select>
        </Field>
        <Field label="Aspiracion salarial"><input style={styles.input} name="aspiracion_salarial" type="number" min="0" value={form.aspiracion_salarial} onChange={updateForm(setForm)} /></Field>
        <Field label="Disponibilidad"><input style={styles.input} name="disponibilidad" value={form.disponibilidad} onChange={updateForm(setForm)} /></Field>
        <Field label="Experiencia"><textarea style={styles.input} name="experiencia" value={form.experiencia} onChange={updateForm(setForm)} /></Field>
        <Field label="Educacion"><textarea style={styles.input} name="educacion" value={form.educacion} onChange={updateForm(setForm)} /></Field>
      </FormBlock>

      <FormBlock title="Skills" description="Selecciona las habilidades que describen tu perfil. Usa Otro si falta alguna.">
        <SkillPicker selectedSkills={selectedSkills} setSelectedSkills={setSelectedSkills} form={form} setForm={setForm} />
      </FormBlock>

      <div>
        <button type="submit" style={styles.primaryButton}>Guardar perfil profesional</button>
      </div>
    </form>
  )
}

function FormBlock({ title, description, children }) {
  return (
    <section style={{ ...styles.card, padding: 20 }}>
      <h3 style={{ margin: '0 0 4px' }}>{title}</h3>
      <p style={{ ...styles.muted, marginTop: 0 }}>{description}</p>
      <div style={styles.grid}>{children}</div>
    </section>
  )
}

function SkillPicker({ selectedSkills, setSelectedSkills, form, setForm }) {
  const toggleSkill = (skill) => {
    setSelectedSkills((prev) => (
      prev.includes(skill) ? prev.filter((item) => item !== skill) : [...prev, skill]
    ))
  }

  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {SKILL_OPTIONS.map((skill) => (
          <label key={skill} style={{ ...styles.tag, cursor: 'pointer', background: selectedSkills.includes(skill) ? '#215d6e' : '#e8f1f3', color: selectedSkills.includes(skill) ? '#ffffff' : '#215d6e' }}>
            <input
              type="checkbox"
              checked={selectedSkills.includes(skill)}
              onChange={() => toggleSkill(skill)}
              style={{ marginRight: 6 }}
            />
            {skill}
          </label>
        ))}
      </div>
      <Field label="Otro">
        <input
          style={styles.input}
          name="other_skills"
          placeholder="Ej: Docker, AWS, Excel avanzado"
          value={form.other_skills}
          onChange={updateForm(setForm)}
        />
      </Field>
    </div>
  )
}

function Field({ label, children }) {
  return <label style={styles.label}>{label}{children}</label>
}

function InfoCard({ title, text }) {
  return (
    <article style={styles.card}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <p style={styles.muted}>{text}</p>
    </article>
  )
}

function DataPanel({ title, empty, children }) {
  const hasItems = React.Children.count(children) > 0
  return (
    <section style={styles.card}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {!hasItems ? <p style={styles.muted}>{empty}</p> : null}
      <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>{children}</ul>
    </section>
  )
}

function NotFound({ navigate }) {
  return (
    <section style={styles.panel}>
      <h2>Pagina no encontrada</h2>
      <button style={styles.primaryButton} onClick={() => navigate('/')}>Volver al inicio</button>
    </section>
  )
}

function emptyProfileForm() {
  return {
    nombre: '',
    telefono: '',
    ciudad: '',
    ocupacion: '',
    other_skills: '',
    rol_objetivo: '',
    modalidad: 'Remoto',
    aspiracion_salarial: '',
    disponibilidad: '',
    experiencia: '',
    educacion: '',
  }
}

function profileFormFromUser(user) {
  return {
    ...emptyProfileForm(),
    nombre: user?.nombre ?? '',
    telefono: user?.telefono ?? '',
    ciudad: user?.ciudad ?? '',
    ocupacion: user?.ocupacion ?? '',
    rol_objetivo: user?.rol_objetivo ?? '',
    modalidad: user?.modalidad ?? 'Remoto',
    aspiracion_salarial: user?.aspiracion_salarial ?? '',
    disponibilidad: user?.disponibilidad ?? '',
    experiencia: user?.experiencia ?? '',
    educacion: user?.educacion ?? '',
  }
}

function buildProfessionalPayload(form, selectedSkills) {
  const otherSkills = form.other_skills.split(',').map((item) => item.trim()).filter(Boolean)
  const skills = [...new Set([...selectedSkills, ...otherSkills])]
  return {
    nombre: form.nombre.trim(),
    telefono: form.telefono.trim() || null,
    ciudad: form.ciudad.trim() || null,
    ocupacion: form.ocupacion.trim() || null,
    intereses: skills,
    skills,
    rol_objetivo: form.rol_objetivo.trim() || null,
    modalidad: form.modalidad,
    aspiracion_salarial: form.aspiracion_salarial ? Number(form.aspiracion_salarial) : null,
    disponibilidad: form.disponibilidad.trim() || null,
    experiencia: form.experiencia.trim() || null,
    educacion: form.educacion.trim() || null,
  }
}

function calculateAge(dateValue) {
  if (!dateValue) return null
  const birthDate = new Date(`${dateValue}T00:00:00`)
  const today = new Date()
  let age = today.getFullYear() - birthDate.getFullYear()
  const hasNotHadBirthday = today.getMonth() < birthDate.getMonth()
    || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
  if (hasNotHadBirthday) age -= 1
  return age
}

function updateForm(setter) {
  return (event) => {
    const { name, value } = event.target
    setter((prev) => ({ ...prev, [name]: value }))
  }
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    credentials: 'include',
    ...options,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.detail ?? `HTTP ${response.status}`)
  }
  return data
}

export default App
