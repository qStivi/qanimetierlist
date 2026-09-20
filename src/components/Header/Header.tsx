import styles from './Header.module.css';

export function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>qanimetierlist</h1>
      <p className={styles.subtitle}>Build a character tier list from your finished AniList anime</p>
    </header>
  );
}
