#include "AdBlocker.h"
#include <QFile>
#include <QTextStream>
#include <QUrl>
#include <QDebug>

AdBlocker::AdBlocker(QObject *parent)
    : QObject(parent)
{
}

void AdBlocker::loadBlocklistFromFile(const QString &filePath)
{
    QFile file(filePath);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qWarning() << "Could not open blocklist file:" << filePath;
        return;
    }

    QTextStream in(&file);
    while (!in.atEnd()) {
        QString line = in.readLine().trimmed();
        if (!line.isEmpty() && !line.startsWith('!') && !line.startsWith('#') && line.contains('.')) {
            m_blockRules.insert(line);
        }
    }
    file.close();
    qDebug() << "Loaded" << m_blockRules.size() << "rules from" << filePath;
}

bool AdBlocker::shouldBlock(const QUrl &url) const
{
    if (!url.isValid()) {
        return false;
    }

    QString urlString = url.toString();
    for (const QString &rule : m_blockRules) {
        if (urlString.contains(rule)) {
            qDebug() << "Blocking URL:" << url.toString() << "due to rule:" << rule;
            return true;
        }
    }

    return false;
}
