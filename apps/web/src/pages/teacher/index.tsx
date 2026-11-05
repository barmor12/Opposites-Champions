import { Navigate, Route, Routes } from 'react-router';
import { TeacherLayout } from './TeacherLayout';
import { LoginPage } from './LoginPage';
import { DashboardPage } from './DashboardPage';
import { CreateGamePage } from './CreateGamePage';
import { LiveRoomPage } from './LiveRoomPage';
import { ResultsPage } from './ResultsPage';
import { WordPairsPage } from './WordPairsPage';

/**
 * נתיבי המורה – מורכב תחת `/teacher/*` באפליקציה הראשית:
 *   <Route path="/teacher/*" element={<TeacherRoutes />} />
 */
export function TeacherRoutes() {
  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route element={<TeacherLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="new" element={<CreateGamePage />} />
        <Route path="rooms/:id" element={<LiveRoomPage />} />
        <Route path="rooms/:id/results" element={<ResultsPage />} />
        <Route path="content" element={<WordPairsPage />} />
        <Route path="*" element={<Navigate to="." replace />} />
      </Route>
    </Routes>
  );
}

export default TeacherRoutes;
export { TeacherLayout, LoginPage, DashboardPage, CreateGamePage, LiveRoomPage, ResultsPage, WordPairsPage };
