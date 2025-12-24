import React, { useState } from 'react';
import { X, Play } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
}

export const ExecutionModal = ({ isOpen, onClose, onSubmit }: Props) => {
    const [formData, setFormData] = useState({
        environment: 'production',
        tests: 'tests/e2e/3.e2e-hybrid.spec.ts',
        retryAttempts: 0
    });

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            taskId: `run-${Date.now()}`,
            tests: [formData.tests],
            config: {
                environment: formData.environment,
                retryAttempts: Number(formData.retryAttempts)
            }
        };
        onSubmit(payload);
        onClose();
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <div className="modal-header" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px',
                    position: 'relative'
                }}>
                    <h2 style={{ margin: 0 }}>Launch New Execution</h2>
                    <button onClick={onClose} className="close-btn">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Environment</label>
                        <select
                            value={formData.environment}
                            onChange={e => setFormData({ ...formData, environment: e.target.value })}
                        >
                            <option value="production">Production</option>
                            <option value="staging">Staging</option>
                            <option value="dev">Dev</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Test Path</label>
                        <input
                            type="text"
                            value={formData.tests}
                            onChange={e => setFormData({ ...formData, tests: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Retry Attempts</label>
                        <input
                            type="number"
                            min="0" max="3"
                            value={formData.retryAttempts}
                            onChange={e => setFormData({ ...formData, retryAttempts: Number(e.target.value) })}
                        />
                    </div>

                    <button type="submit" className="submit-btn">Run Execution</button>
                </form>
            </div>
        </div>
    );
};