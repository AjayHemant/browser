#ifndef ADBLOCKER_H
#define ADBLOCKER_H

#include <QObject>
#include <QString>
#include <QSet>

class QUrl;

class AdBlocker : public QObject
{
    Q_OBJECT

public:
    explicit AdBlocker(QObject *parent = nullptr);
    void loadBlocklistFromFile(const QString &filePath);
    bool shouldBlock(const QUrl &url) const;

private:
    QSet<QString> m_blockRules;
};

#endif // ADBLOCKER_H
