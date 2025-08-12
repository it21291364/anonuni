import Header from '../components/Header.jsx'
import MatchForm from '../components/MatchForm.jsx'

export default function Home({ onStart, queued }){
  return (
    <div className="container">
      <Header />
      <div className="card" style={{marginTop:16, position:'relative'}}>
        <h2 style={{marginTop:0}}>Find a chat partner</h2>
        <MatchForm onStart={onStart} disabled={queued} />

        {queued && (
          <div className="overlay">
            <div className="loader">
              <div className="spinner"/>
              <div className="small" style={{marginTop:8}}>Looking for a partner…</div>
            </div>
          </div>
        )}
      </div>
      <div className="small" style={{marginTop:12}}>
        Tip: Use common interests like “cricket, anime, startup, exams” for faster matching.
      </div>
    </div>
  )
}