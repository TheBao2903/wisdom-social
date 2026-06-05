package iuh.fit.edu.backend.common.util;

import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

public class TransactionUtil {

    private TransactionUtil() {
        // Ẩn constructor vì đây là class chứa static methods
    }

    /**
     * Trì hoãn một hành động (Runnable) cho đến khi DB Transaction hiện tại commit thành công.
     * Tránh việc DB bị Rollback nhưng Redis/Cache vẫn bị ghi đè.
     * Nếu không nằm trong Transaction nào, thực thi ngay lập tức.
     */
    public static void executeAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}