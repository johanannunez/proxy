import styles from "./loading.module.css";

export default function FormBuilderLoading() {
  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.shimmer} style={{ width: 28, height: 28, borderRadius: 8 }} />
          <div className={styles.shimmer} style={{ width: 180, height: 20, borderRadius: 6 }} />
        </div>
        <div className={styles.headerRight}>
          <div className={styles.shimmer} style={{ width: 80, height: 32, borderRadius: 8 }} />
          <div className={styles.shimmer} style={{ width: 100, height: 32, borderRadius: 8 }} />
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.canvas}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.fieldCard}>
              <div className={styles.shimmer} style={{ width: 80, height: 11, borderRadius: 4, marginBottom: 10 }} />
              <div className={styles.shimmer} style={{ width: "100%", height: 38, borderRadius: 8 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
