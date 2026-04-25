import { Navigate, Route, Routes } from 'react-router-dom';
import Home from './screens/Home';
import Transfer from './screens/Transfer';
import Payee from './screens/Payee';
import Confirm from './screens/Confirm';
import Intercept from './screens/Intercept';
import Explain from './screens/Explain';
import Done from './screens/Done';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/home" element={<Home />} />
      <Route path="/transfer" element={<Transfer />} />
      <Route path="/payee" element={<Payee />} />
      <Route path="/confirm" element={<Confirm />} />
      <Route path="/intercept" element={<Intercept />} />
      <Route path="/explain" element={<Explain />} />
      <Route path="/done" element={<Done />} />
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
