import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { FeedbackProvider } from './context/FeedbackContext';
import { InventoryProvider } from './context/InventoryContext';
import { MaintenanceProvider } from './context/MaintenanceContext';
import { NotificationProvider } from './context/NotificationContext';
import { SupplyProvider } from './context/SupplyContext';
import './styles/global.css';

createRoot(document.getElementById('root')).render(
    <BrowserRouter>
        <AuthProvider>
            <ChatProvider>
                <InventoryProvider>
                    <FeedbackProvider>
                        <NotificationProvider>
                            <SupplyProvider>
                                <MaintenanceProvider>
                                    <App />
                                </MaintenanceProvider>
                            </SupplyProvider>
                        </NotificationProvider>
                    </FeedbackProvider>
                </InventoryProvider>
            </ChatProvider>
        </AuthProvider>
    </BrowserRouter>
);
