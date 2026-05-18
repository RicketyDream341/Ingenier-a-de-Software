import React, { useEffect, useState } from 'react'
import logo from './assets/logo.jpeg'

const API_BASE_URL = 'http://127.0.0.1:8000'
const CSRF_STORAGE_KEY = 'profile_manager_csrf'

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
      .then((data) => {
        updateCurrentUser(data.user)
        setCsrfToken(data.csrf_token)
      })
      .catch(() => {
        window.localStorage.removeItem('profile_manager_user')
        window.localStorage.removeItem(CSRF_STORAGE_KEY)
        setCurrentUser(null)
      })
  }, [])

  const login = (user, csrfToken) => {
    window.localStorage.setItem('profile_manager_user', JSON.stringify(user))
    setCsrfToken(csrfToken)
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
    window.localStorage.removeItem(CSRF_STORAGE_KEY)
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
    account_type: 'candidate',
    username: '',
    nombre: '',
    email: '',
    password: '',
    fecha_nacimiento: '',
    empresa: '',
  })

  const submitRegister = async (event) => {
    event.preventDefault()
    try {
      const data = await requestJson('/users', {
        method: 'POST',
        body: JSON.stringify({
          account_type: form.account_type,
          username: form.username.trim(),
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
          empresa: form.account_type === 'recruiter' ? form.empresa.trim() || null : null,
          fecha_nacimiento: form.fecha_nacimiento,
          edad: form.account_type === 'candidate' ? calculateAge(form.fecha_nacimiento) : null,
          skills: [],
          intereses: [],
        }),
      })
      setMessage(form.account_type === 'recruiter'
        ? `Cuenta de reclutador creada. Tu ID es ${data.user.id}.`
        : `Perfil creado. Tu ID de candidato es ${data.user.id}.`)
      navigate('/login')
    } catch (error) {
      setMessage(`No fue posible crear el perfil: ${error.message}`)
    }
  }

  return (
    <section style={{ ...styles.panel, maxWidth: 720 }}>
      <h2 style={{ marginTop: 0 }}>Crear cuenta</h2>
      <p style={styles.muted}>
        Registra tus datos basicos. Los candidatos completan su perfil profesional despues de iniciar sesion. Los reclutadores podran definir pesos para evaluar candidatos.
      </p>
      <form onSubmit={submitRegister} style={styles.grid}>
        <Field label="Tipo de cuenta">
          <select style={styles.input} name="account_type" value={form.account_type} onChange={updateForm(setForm)}>
            <option value="candidate">Candidato</option>
            <option value="recruiter">Reclutador</option>
          </select>
        </Field>
        <Field label="Nombre de usuario">
          <input style={styles.input} name="username" value={form.username} onChange={updateForm(setForm)} required />
        </Field>
        <Field label="Nombre completo">
          <input style={styles.input} name="nombre" value={form.nombre} onChange={updateForm(setForm)} required />
        </Field>
        {form.account_type === 'recruiter' ? (
          <Field label="Empresa">
            <input style={styles.input} name="empresa" value={form.empresa} onChange={updateForm(setForm)} />
          </Field>
        ) : null}
        <Field label="Email">
          <input style={styles.input} name="email" type="email" value={form.email} onChange={updateForm(setForm)} required />
        </Field>
        <Field label="Contrasena">
          <input style={styles.input} name="password" type="password" value={form.password} onChange={updateForm(setForm)} required />
        </Field>
        {form.account_type === 'candidate' ? (
          <Field label="Fecha de nacimiento">
            <input style={styles.input} name="fecha_nacimiento" type="date" value={form.fecha_nacimiento} onChange={updateForm(setForm)} required />
          </Field>
        ) : null}
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
      login(data.user, data.csrf_token)
    } catch (error) {
      setMessage(`No fue posible iniciar sesion: ${error.message}`)
    }
  }

  return (
    <section style={{ ...styles.panel, maxWidth: 680 }}>
      <h2 style={{ marginTop: 0 }}>Ingreso</h2>
      <p style={styles.muted}>Accede como candidato o reclutador para usar el dashboard correspondiente.</p>
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
  if (currentUser?.account_type === 'recruiter') {
    return <RecruiterDashboard currentUser={currentUser} navigate={navigate} setMessage={setMessage} updateCurrentUser={updateCurrentUser} />
  }

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
        <p style={styles.tag}>Candidato</p>
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

function RecruiterDashboard({ currentUser, navigate, setMessage, updateCurrentUser }) {
  const [vacancies, setVacancies] = useState([])
  const [selectedVacancyId, setSelectedVacancyId] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [applications, setApplications] = useState([])
  const [form, setForm] = useState(() => recruiterFormFromUser(currentUser))
  const [vacancyForm, setVacancyForm] = useState(() => emptyRecruiterVacancyForm(currentUser))

  const loadVacancies = async () => {
    const data = await requestJson(`/recruiters/${currentUser.id}/vacancies`)
    const vacancyList = data.vacancies ?? []
    setVacancies(vacancyList)
    if (!selectedVacancyId && vacancyList[0]?.id) {
      setSelectedVacancyId(vacancyList[0].id)
    } else if (!vacancyList.length) {
      setVacancyForm(emptyRecruiterVacancyForm(currentUser))
    }
  }

  const loadRecommendations = async (vacancyId = selectedVacancyId) => {
    if (!vacancyId) return
    const data = await requestJson(`/recruiters/${currentUser.id}/recommendations?vacancy_id=${encodeURIComponent(vacancyId)}`)
    setRecommendations(data.recommendations ?? [])
  }

  const loadApplications = async (vacancyId = selectedVacancyId) => {
    if (!vacancyId) return
    const data = await requestJson(`/recruiters/${currentUser.id}/applications?vacancy_id=${encodeURIComponent(vacancyId)}`)
    setApplications(data.applications ?? [])
  }

  useEffect(() => {
    if (currentUser) {
      setForm(recruiterFormFromUser(currentUser))
      setVacancyForm(emptyRecruiterVacancyForm(currentUser))
      loadVacancies().catch((error) => setMessage(`No se pudieron cargar las vacantes: ${error.message}`))
    }
  }, [currentUser])

  useEffect(() => {
    if (selectedVacancyId) {
      loadApplications(selectedVacancyId).catch((error) => setMessage(`No se pudieron cargar las postulaciones de la vacante: ${error.message}`))
      if (configurationTotal(form, vacancyForm) === 100) {
        loadRecommendations(selectedVacancyId).catch((error) => setMessage(`No se pudieron cargar las recomendaciones del reclutador: ${error.message}`))
      } else {
        setRecommendations([])
      }
    }
  }, [selectedVacancyId])

  useEffect(() => {
    if (!selectedVacancyId) return
    const selectedVacancy = vacancies.find((item) => item.id === selectedVacancyId)
    if (selectedVacancy) {
      setVacancyForm(vacancyFormFromVacancy(selectedVacancy, currentUser))
    }
  }, [selectedVacancyId, vacancies, currentUser])

  if (!currentUser) {
    return (
      <section style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>Acceso requerido</h2>
        <button style={styles.primaryButton} onClick={() => navigate('/login')}>Ir al login</button>
      </section>
    )
  }

  const totalWeight = configurationTotal(form, vacancyForm)

  const saveRecruiterProfile = async (event) => {
    event.preventDefault()
    try {
      const data = await requestJson('/users', {
        method: 'POST',
        body: JSON.stringify({
          id: currentUser.id,
          account_type: 'recruiter',
          username: currentUser.username,
          nombre: form.nombre.trim() || currentUser.nombre,
          email: currentUser.email,
          empresa: form.empresa.trim() || null,
          recruiter_city_preferences: serializeCityPreferences(form.recruiter_city_preferences),
          recruiter_weight_role: Number(form.recruiter_weight_role),
          recruiter_weight_modality: Number(form.recruiter_weight_modality),
        }),
      })
      updateCurrentUser(data.user)
      setMessage('Preferencias del reclutador actualizadas.')
      if (selectedVacancyId && configurationTotal(form, vacancyForm) === 100) {
        await loadRecommendations()
      }
    } catch (error) {
      setMessage(`No fue posible guardar los pesos del reclutador: ${error.message}`)
    }
  }

  const saveVacancy = async (event) => {
    event.preventDefault()
    try {
      const payload = buildRecruiterVacancyPayload(vacancyForm, currentUser)
      const data = await requestJson(`/recruiters/${currentUser.id}/vacancies`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      await loadVacancies()
      setSelectedVacancyId(data.vacancy.id)
      setVacancyForm(vacancyFormFromVacancy(data.vacancy, currentUser))
      setMessage(vacancyForm.id ? 'Vacante actualizada.' : 'Vacante creada.')
    } catch (error) {
      setMessage(`No fue posible guardar la vacante: ${error.message}`)
    }
  }

  return (
    <>
      <section style={styles.panel}>
        <p style={styles.tag}>Reclutador</p>
        <h2 style={{ marginTop: 0 }}>{currentUser.nombre}</h2>
        <p style={styles.muted}>Empresa: <strong>{currentUser.empresa ?? 'No definida'}</strong></p>
      </section>

      <section style={styles.section}>
        <RecruiterWeightsForm form={form} setForm={setForm} totalWeight={totalWeight} onSubmit={saveRecruiterProfile} />
      </section>

      <section style={styles.section}>
        <RecruiterVacancyForm
          form={vacancyForm}
          setForm={setVacancyForm}
          currentUser={currentUser}
          totalWeight={totalWeight}
          onSubmit={saveVacancy}
          onCreateNew={() => {
            setSelectedVacancyId('')
            setVacancyForm(emptyRecruiterVacancyForm(currentUser))
            setRecommendations([])
            setApplications([])
          }}
        />
      </section>

      <section style={styles.section}>
        <section style={styles.card}>
          <h3 style={{ marginTop: 0 }}>Vacante a evaluar</h3>
          <p style={styles.muted}>Selecciona una vacante administrada por ti para revisar postulaciones y calcular el ranking.</p>
          <Field label="Vacante">
            <select style={styles.input} value={selectedVacancyId} onChange={(event) => setSelectedVacancyId(event.target.value)}>
              <option value="">Selecciona una vacante</option>
              {vacancies.map((vacancy) => (
                <option key={vacancy.id} value={vacancy.id}>{vacancy.titulo} · {vacancy.rol}</option>
              ))}
            </select>
          </Field>
        </section>
      </section>

      <section style={styles.section}>
        <h2>Ranking de candidatos</h2>
        {selectedVacancyId && totalWeight !== 100 ? (
          <p style={styles.status}>Ajusta la configuracion de pesos para que el total sea exactamente 100 antes de calcular el ranking.</p>
        ) : null}
        <div style={{ display: 'grid', gap: 14 }}>
          {recommendations.map((item) => (
            <article key={item.candidate.id} style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: '0 0 8px' }}>{item.candidate.nombre}</h3>
                  <p style={{ ...styles.muted, margin: 0 }}>
                    {item.candidate.rol_objetivo ?? 'Sin rol objetivo'} · {item.candidate.ciudad ?? 'Sin ciudad'} · {item.candidate.modalidad ?? 'Sin modalidad'}
                  </p>
                </div>
                <strong style={{ fontSize: 28, color: '#215d6e' }}>{item.score}</strong>
              </div>
              <p style={{ ...styles.muted, marginBottom: 10 }}><strong>Explicacion:</strong> {item.explanation}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={styles.tag}>Ciudad {item.score_breakdown.city}/{item.weights.city}</span>
                <span style={styles.tag}>Rol {item.score_breakdown.role}/{item.weights.role}</span>
                <span style={styles.tag}>Skills {item.score_breakdown.skills}/{item.weights.skills}</span>
                <span style={styles.tag}>Modalidad {item.score_breakdown.modality}/{item.weights.modality}</span>
              </div>
              <div>
                {(item.matched_skills ?? []).map((skill) => <span key={skill} style={{ ...styles.tag, background: '#dff4e5', color: '#1e6b3b' }}>{skill}</span>)}
                {(item.missing_skills ?? []).map((skill) => <span key={skill} style={{ ...styles.tag, background: '#f3e7e3', color: '#8a3d24' }}>{skill}</span>)}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.section}>
        <h2>Postulaciones recibidas</h2>
        <div style={{ display: 'grid', gap: 14 }}>
          {applications.map((item) => (
            <article key={item.application.id} style={styles.card}>
              <h3 style={{ margin: '0 0 8px' }}>{item.candidate.nombre}</h3>
              <p style={{ ...styles.muted, margin: 0 }}>
                {item.candidate.rol_objetivo ?? 'Sin rol objetivo'} · {item.candidate.ciudad ?? 'Sin ciudad'}
              </p>
              <p style={{ ...styles.muted, marginTop: 10 }}>Estado: {item.application.estado}</p>
              {(item.candidate.skills ?? []).map((skill) => <span key={skill} style={styles.tag}>{skill}</span>)}
            </article>
          ))}
          {applications.length === 0 ? <p style={styles.muted}>No hay postulaciones registradas para esta vacante.</p> : null}
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

function RecruiterWeightsForm({ form, setForm, totalWeight, onSubmit }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 22 }}>
      <FormBlock title="Preferencias del reclutador" description="Distribuye el puntaje de evaluacion entre las caracteristicas mas relevantes para tu proceso de seleccion.">
        <Field label="Nombre completo"><input style={styles.input} name="nombre" value={form.nombre} onChange={updateForm(setForm)} required /></Field>
        <Field label="Empresa"><input style={styles.input} name="empresa" value={form.empresa} onChange={updateForm(setForm)} /></Field>
        <Field label="Peso por rol"><input style={styles.input} name="recruiter_weight_role" type="number" min="0" max="100" value={form.recruiter_weight_role} onChange={updateForm(setForm)} required /></Field>
        <Field label="Peso por modalidad"><input style={styles.input} name="recruiter_weight_modality" type="number" min="0" max="100" value={form.recruiter_weight_modality} onChange={updateForm(setForm)} required /></Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={styles.label}>Ciudad del candidato</label>
          <div style={{ display: 'grid', gap: 10 }}>
            {form.recruiter_city_preferences.map((preference, index) => (
              <div key={preference.rowId} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) minmax(120px, 1fr) auto', gap: 10, alignItems: 'end' }}>
                <Field label={`Ciudad ${index + 1}`}>
                  <input
                    style={styles.input}
                    value={preference.city}
                    onChange={(event) => updateRecruiterCityPreference(setForm, index, 'city', event.target.value)}
                    placeholder="Ej: Bogota"
                  />
                </Field>
                <Field label="Puntos">
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    max="100"
                    value={preference.points}
                    onChange={(event) => updateRecruiterCityPreference(setForm, index, 'points', event.target.value)}
                  />
                </Field>
                <button type="button" style={styles.button} onClick={() => removeRecruiterCityPreference(setForm, index)}>Quitar</button>
              </div>
            ))}
            <div>
              <button type="button" style={styles.button} onClick={() => addRecruiterCityPreference(setForm)}>Agregar ciudad</button>
            </div>
          </div>
        </div>
      </FormBlock>
      <p style={{ ...styles.status, marginBottom: 0 }}>Suma actual de pesos: <strong>{totalWeight}</strong>/100</p>
      <div>
        <button type="submit" style={styles.primaryButton}>Guardar pesos del reclutador</button>
      </div>
    </form>
  )
}

function RecruiterVacancyForm({ form, setForm, currentUser, totalWeight, onSubmit, onCreateNew }) {
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 22 }}>
      <FormBlock title="Vacante" description="Crea o edita una oferta de trabajo y asigna un puntaje especifico a cada skill requerida.">
        <Field label="Titulo de la vacante"><input style={styles.input} name="titulo" value={form.titulo} onChange={updateForm(setForm)} required /></Field>
        <Field label="Empresa"><input style={styles.input} name="empresa" value={form.empresa} onChange={updateForm(setForm)} placeholder={currentUser?.empresa ?? 'Empresa'} /></Field>
        <Field label="Rol"><input style={styles.input} name="rol" value={form.rol} onChange={updateForm(setForm)} required /></Field>
        <Field label="Lugar de trabajo"><input style={styles.input} name="ubicacion" value={form.ubicacion} onChange={updateForm(setForm)} /></Field>
        <Field label="Modalidad">
          <select style={styles.input} name="modalidad" value={form.modalidad} onChange={updateForm(setForm)}>
            <option>Remoto</option>
            <option>Hibrido</option>
            <option>Presencial</option>
          </select>
        </Field>
        <Field label="Salario referencial"><input style={styles.input} name="salario" type="number" min="0" value={form.salario} onChange={updateForm(setForm)} /></Field>
        <div style={{ gridColumn: '1 / -1' }}>
          <Field label="Descripcion">
            <textarea style={styles.input} name="descripcion" value={form.descripcion} onChange={updateForm(setForm)} />
          </Field>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={styles.label}>Skills requeridas</label>
          <div style={{ display: 'grid', gap: 10 }}>
            {(form.skill_weights ?? []).map((item, index) => (
              <div key={item.rowId} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 2fr) minmax(120px, 1fr) auto', gap: 10, alignItems: 'end' }}>
                <Field label={`Skill ${index + 1}`}>
                  <input
                    style={styles.input}
                    value={item.skill}
                    onChange={(event) => updateVacancySkillWeight(setForm, index, 'skill', event.target.value)}
                    placeholder="Ej: Python"
                  />
                </Field>
                <Field label="Puntos">
                  <input
                    style={styles.input}
                    type="number"
                    min="0"
                    max="100"
                    value={item.points}
                    onChange={(event) => updateVacancySkillWeight(setForm, index, 'points', event.target.value)}
                  />
                </Field>
                <button type="button" style={styles.button} onClick={() => removeVacancySkillWeight(setForm, index)}>Quitar</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" style={styles.button} onClick={() => addVacancySkillWeight(setForm)}>Agregar skill</button>
              <button type="button" style={styles.button} onClick={onCreateNew}>Nueva vacante</button>
            </div>
          </div>
        </div>
      </FormBlock>
      <p style={{ ...styles.status, marginBottom: 0 }}>Configuracion actual: <strong>{totalWeight}</strong>/100</p>
      <div>
        <button type="submit" style={styles.primaryButton}>{form.id ? 'Guardar cambios de la vacante' : 'Crear vacante'}</button>
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
    experiencia: form.experiencia.trim() || null,
    educacion: form.educacion.trim() || null,
  }
}

function recruiterFormFromUser(user) {
  const recruiterCityPreferences = parseCityPreferences(user?.recruiter_city_preferences)
  const legacyCityWeight = Number(user?.recruiter_weight_city ?? 0)
  const normalizedCityPreferences = recruiterCityPreferences.length > 0
    ? recruiterCityPreferences
    : (legacyCityWeight > 0 ? [{ rowId: createRowId(), city: user?.recruiter_target_city ?? '', points: legacyCityWeight }] : [{ rowId: createRowId(), city: '', points: '' }])
  return {
    nombre: user?.nombre ?? '',
    empresa: user?.empresa ?? '',
    recruiter_city_preferences: normalizedCityPreferences,
    recruiter_weight_role: user?.recruiter_weight_role ?? 40,
    recruiter_weight_modality: user?.recruiter_weight_modality ?? 20,
  }
}

function configurationTotal(form, vacancyForm) {
  const cityPoints = (form.recruiter_city_preferences ?? []).reduce((sum, preference) => sum + Number(preference.points || 0), 0)
  const skillPoints = (vacancyForm.skill_weights ?? []).reduce((sum, item) => sum + Number(item.points || 0), 0)
  return cityPoints + skillPoints + [
    form.recruiter_weight_role,
    form.recruiter_weight_modality,
  ].reduce((sum, value) => sum + Number(value || 0), 0)
}

function parseCityPreferences(values) {
  const parsed = (values ?? []).map((value) => {
    const [city, points] = String(value).split('|')
    return { rowId: createRowId(), city: city?.trim() ?? '', points: points?.trim() ?? '' }
  }).filter((preference) => preference.city || preference.points)
  return parsed
}

function serializeCityPreferences(preferences) {
  return (preferences ?? [])
    .map((preference) => ({
      city: String(preference.city ?? '').trim(),
      points: String(preference.points ?? '').trim(),
    }))
    .filter((preference) => preference.city && preference.points !== '')
    .map((preference) => `${preference.city}|${Number(preference.points)}`)
}

function addRecruiterCityPreference(setForm) {
  setForm((prev) => ({
    ...prev,
    recruiter_city_preferences: [...(prev.recruiter_city_preferences ?? []), { rowId: createRowId(), city: '', points: '' }],
  }))
}

function removeRecruiterCityPreference(setForm, index) {
  setForm((prev) => {
    const nextPreferences = (prev.recruiter_city_preferences ?? []).filter((_, currentIndex) => currentIndex !== index)
    return {
      ...prev,
      recruiter_city_preferences: nextPreferences.length > 0 ? nextPreferences : [{ city: '', points: '' }],
    }
  })
}

function updateRecruiterCityPreference(setForm, index, field, value) {
  setForm((prev) => ({
    ...prev,
    recruiter_city_preferences: (prev.recruiter_city_preferences ?? []).map((preference, currentIndex) => (
      currentIndex === index ? { ...preference, [field]: value } : preference
    )),
  }))
}

function emptyRecruiterVacancyForm(user) {
  return {
    id: '',
    titulo: '',
    empresa: user?.empresa ?? '',
    rol: '',
    ubicacion: '',
    modalidad: 'Remoto',
    salario: '',
    descripcion: '',
    skill_weights: [{ rowId: createRowId(), skill: '', points: '' }],
  }
}

function parseSkillWeights(values) {
  return (values ?? []).map((value) => {
    const [skill, points] = String(value).split('|')
    return { rowId: createRowId(), skill: skill?.trim() ?? '', points: points?.trim() ?? '' }
  }).filter((item) => item.skill || item.points)
}

function vacancyFormFromVacancy(vacancy, currentUser) {
  const parsedSkillWeights = parseSkillWeights(vacancy?.skill_weights)
  return {
    id: vacancy?.id ?? '',
    titulo: vacancy?.titulo ?? '',
    empresa: vacancy?.empresa ?? currentUser?.empresa ?? '',
    rol: vacancy?.rol ?? '',
    ubicacion: vacancy?.ubicacion ?? '',
    modalidad: vacancy?.modalidad ?? 'Remoto',
    salario: vacancy?.salario ?? '',
    descripcion: vacancy?.descripcion ?? '',
    skill_weights: parsedSkillWeights.length > 0 ? parsedSkillWeights : [{ rowId: createRowId(), skill: '', points: '' }],
  }
}

function serializeSkillWeights(values) {
  return (values ?? [])
    .map((item) => ({
      skill: String(item.skill ?? '').trim(),
      points: String(item.points ?? '').trim(),
    }))
    .filter((item) => item.skill && item.points !== '')
    .map((item) => `${item.skill}|${Number(item.points)}`)
}

function buildRecruiterVacancyPayload(form, currentUser) {
  const skillWeights = serializeSkillWeights(form.skill_weights)
  const skills = skillWeights.map((item) => item.split('|')[0])
  return {
    id: form.id || undefined,
    titulo: form.titulo.trim(),
    empresa: form.empresa.trim() || currentUser?.empresa || null,
    rol: form.rol.trim(),
    ubicacion: form.ubicacion.trim() || null,
    modalidad: form.modalidad,
    salario: form.salario === '' ? null : Number(form.salario),
    descripcion: form.descripcion.trim() || null,
    skills,
    skill_weights: skillWeights,
  }
}

function addVacancySkillWeight(setForm) {
  setForm((prev) => ({
    ...prev,
    skill_weights: [...(prev.skill_weights ?? []), { rowId: createRowId(), skill: '', points: '' }],
  }))
}

function removeVacancySkillWeight(setForm, index) {
  setForm((prev) => {
    const nextValues = (prev.skill_weights ?? []).filter((_, currentIndex) => currentIndex !== index)
    return {
      ...prev,
      skill_weights: nextValues.length > 0 ? nextValues : [{ rowId: createRowId(), skill: '', points: '' }],
    }
  })
}

function updateVacancySkillWeight(setForm, index, field, value) {
  setForm((prev) => ({
    ...prev,
    skill_weights: (prev.skill_weights ?? []).map((item, currentIndex) => (
      currentIndex === index ? { ...item, [field]: value } : item
    )),
  }))
}

function createRowId() {
  return `row-${Math.random().toString(36).slice(2, 10)}`
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
  const method = (options.method ?? 'GET').toUpperCase()
  const csrfToken = window.localStorage.getItem(CSRF_STORAGE_KEY)
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers['X-CSRF-Token'] = csrfToken
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers,
    credentials: 'include',
    ...options,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.detail ?? `HTTP ${response.status}`)
  }
  return data
}

function setCsrfToken(token) {
  if (token) {
    window.localStorage.setItem(CSRF_STORAGE_KEY, token)
  }
}

export default App
